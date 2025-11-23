# 💼 Sistema de Cargos/Funções (Job Titles)

## Visão Geral

O sistema de cargos/funções permite que organizações definam e atribuam cargos específicos aos membros de suas equipes, separando **permissões do sistema** (roles) de **funções organizacionais** (job titles).

## Conceitos

### **Roles vs Job Titles**

- **Roles** (Permissões)
  - Define o que o usuário **pode fazer** no sistema
  - Controla acesso a funcionalidades
  - Exemplos: `ADMIN`, `MANAGER`, `CLERK`, `ANALYST`, `BILLING`

- **Job Titles** (Cargos/Funções)
  - Define a **função real** do membro na organização
  - Apenas informativo, não afeta permissões
  - Exemplos: Recepcionista, Coordenador, Zelador, Assistente Social

## Estrutura

### Tabela `job_titles`

```sql
CREATE TABLE job_titles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  unit_id UUID REFERENCES units(id),
  UNIQUE (name, organization_id, unit_id)
);
```

### Tabela `members` (atualizada)

```sql
ALTER TABLE members 
ADD COLUMN job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL;
```

## Funcionalidades

### 1. Criar Cargo

**Cargo a nível de organização:**
```http
POST /organizations/{organizationSlug}/job-titles
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Recepcionista",
  "description": "Responsável pelo atendimento inicial"
}
```

**Cargo específico de uma unidade:**
```http
POST /organizations/{organizationSlug}/job-titles
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Coordenador de Enfermagem",
  "description": "Coordenador da equipe de enfermagem",
  "unit_id": "uuid-da-unidade"
}
```

### 2. Listar Cargos

**Todos os cargos da organização:**
```http
GET /organizations/{organizationSlug}/job-titles?page=1&limit=20
Authorization: Bearer {token}
```

**Cargos de uma unidade específica:**
```http
GET /organizations/{organizationSlug}/job-titles?unit_id={unitId}&page=1&limit=20
Authorization: Bearer {token}
```

### 3. Buscar Cargo Específico

```http
GET /organizations/{organizationSlug}/job-titles/{jobTitleId}
Authorization: Bearer {token}
```

### 4. Atualizar Cargo

```http
PATCH /organizations/{organizationSlug}/job-titles/{jobTitleId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Recepcionista Senior",
  "description": "Recepcionista com supervisão de estagiários"
}
```

### 5. Deletar Cargo

```http
DELETE /organizations/{organizationSlug}/job-titles/{jobTitleId}
Authorization: Bearer {token}
```

**Nota:** Ao deletar um cargo, o campo `job_title_id` dos membros que possuem esse cargo será definido como `NULL` (devido ao `ON DELETE SET NULL`).

## Casos de Uso

### Exemplo 1: Hospital com Múltiplos Setores

```javascript
// Organização: Hospital Central
// Cargos gerais (organization-level):
- "Diretor Médico"
- "Coordenador Administrativo"
- "Gerente de RH"

// Unidade: Ala de Emergência
// Cargos específicos:
- "Médico Plantonista - Emergência"
- "Enfermeiro de Emergência"
- "Técnico de Enfermagem - Emergência"

// Unidade: Ala Pediátrica
// Cargos específicos:
- "Médico Pediatra"
- "Enfermeiro Pediatra"
- "Recreador Infantil"
```

### Exemplo 2: Atribuir Cargo a Membro

```javascript
// Membro da equipe
{
  "user_id": "uuid-do-usuario",
  "organization_id": "uuid-da-org",
  "unit_id": "uuid-da-unidade",
  "organization_role": "CLERK",     // Permissões limitadas
  "unit_role": "MANAGER",           // Pode gerenciar a unidade
  "job_title_id": "uuid-do-cargo"   // "Coordenador de Recepção"
}
```

### Exemplo 3: Múltiplos Membros com Mesmo Cargo

```javascript
// Cargo criado uma vez
{
  "id": "cargo-123",
  "name": "Recepcionista",
  "organization_id": "org-789"
}

// Vários membros podem ter este cargo
[
  {
    "name": "João Silva",
    "role": "CLERK",
    "job_title_id": "cargo-123"
  },
  {
    "name": "Maria Santos",
    "role": "CLERK",
    "job_title_id": "cargo-123"
  },
  {
    "name": "Ana Costa",
    "role": "CLERK",
    "job_title_id": "cargo-123"
  }
]
```

## Permissões

- **Criar/Editar/Deletar Cargos**: Requer permissão `manage:Organization` (ADMIN ou MANAGER)
- **Visualizar Cargos**: Qualquer membro da organização

## Regras de Negócio

1. ✅ Um cargo pode ser atribuído a múltiplos membros
2. ✅ Não pode haver dois cargos com o mesmo nome na mesma organização/unidade
3. ✅ Cargos podem ser criados a nível de organização (para todas as unidades) ou específicos de uma unidade
4. ✅ Ao deletar um cargo, membros perdem a associação (job_title_id = NULL)
5. ✅ Um membro pode ter um cargo mesmo sem ter role de gerenciamento

## Benefícios

- 📊 **Relatórios**: Filtrar membros por cargo
- 🏢 **Organização**: Hierarquia clara da estrutura organizacional
- 🔄 **Flexibilidade**: Separação entre permissões técnicas e funções organizacionais
- 📝 **Documentação**: Clareza sobre a função de cada membro
- 🎯 **Escalabilidade**: Reutilização de cargos em diferentes contextos

## Migração

A migração foi gerada automaticamente e inclui:
- Criação da tabela `job_titles`
- Adição do campo `job_title_id` na tabela `members`
- Índice único para evitar duplicatas de cargos
- Foreign keys com `ON DELETE SET NULL` para segurança

Para aplicar:
```bash
npm run db:migrate
```
