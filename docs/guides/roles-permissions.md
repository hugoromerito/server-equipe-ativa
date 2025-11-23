# 🔐 Guia de Roles e Permissões - Sistema de Clínica Médica

Este documento descreve as permissões de cada role (função) no sistema, otimizado para o contexto de clínica médica.

## 📊 Visão Geral

O sistema utiliza 5 roles principais:

| Role | Descrição | Contexto Clínica |
|------|-----------|------------------|
| **ADMIN** | Administrador | Dono da organização ou administrador da unidade |
| **MANAGER** | Gerente | RH (Recursos Humanos) |
| **CLERK** | Atendente | Recepcionista |
| **ANALYST** | Analista | Médico/Profissional de Saúde |
| **BILLING** | Faturamento | Faturista |

---

## 🔑 Permissões Detalhadas por Role

### 👑 **ADMIN** - Administrador

#### Contexto
- Dono da organização ou administrador com permissões elevadas
- Pode ter dois níveis: dono da org (poder total) ou não-dono (poder limitado)

#### Permissões

**Se for DONO da Organização:**
- ✅ **Gerenciar tudo** (`manage all`)
- ✅ Transferir propriedade de organizações e unidades
- ✅ Criar, editar e deletar usuários
- ✅ Gerenciar todas as unidades
- ✅ Visualizar e gerenciar todos os applicants e demands
- ✅ Todas as funcionalidades de todas as outras roles

**Se NÃO for dono:**
- ✅ Gerenciar sua unidade
- ✅ Visualizar tudo da unidade
- ✅ Criar usuários (mas não deletar)
- ❌ Não pode transferir propriedade
- ❌ Não pode deletar usuários críticos

#### Código de Permissão
```typescript
can('manage', 'all')
cannot(['transfer_ownership', 'update'], 'Unit')
can(['transfer_ownership', 'update'], 'Unit', { ownerId: { $eq: user.id } })
can(['transfer_ownership', 'update'], 'Organization', { owner_id: { $eq: user.id } })
```

---

### 👔 **MANAGER** - RH (Recursos Humanos)

#### Contexto
- Gerencia recursos humanos da unidade (clínica)
- Responsável por funcionários, horários e folha de ponto

#### Permissões

**Applicants (Pacientes):**
- ✅ Visualizar applicants da unit
- ✅ Criar novos applicants

**Demands (Atendimentos):**
- ✅ Criar demands
- ✅ Visualizar todas as demands da unit

**Usuários (Members):**
- ✅ Criar usuários/funcionários
- ✅ Editar informações dos usuários
- ✅ Gerenciar horários de trabalho (working days)
- ✅ Alterar disponibilidade e schedule dos members
- ✅ Gerar folha de ponto (timesheet PDF) de qualquer member da unit
- ✅ Visualizar informações de todos os members
- ❌ **NÃO pode** deletar usuários

#### Fluxo Típico
1. Cadastrar novos funcionários (médicos, recepcionistas, etc.)
2. Definir dias de trabalho de cada profissional
3. Configurar horários e disponibilidade
4. Gerar relatórios de folha de ponto mensais
5. Visualizar pacientes e atendimentos para gestão

#### Código de Permissão
```typescript
can('get', 'Applicant')
can('create', 'Applicant')
can('create', 'Demand')
can('get', 'Demand')
can('manage', 'User')
cannot('delete', 'User')
```

---

### 📝 **CLERK** - Recepcionista

#### Contexto
- Primeiro contato com pacientes
- Gerencia cadastro de pacientes e agendamento de consultas

#### Permissões

**Applicants (Pacientes):**
- ✅ Cadastrar novos pacientes
- ✅ Visualizar informações dos pacientes da unit
- ❌ NÃO cria usuários do sistema (apenas applicants)

**Demands (Atendimentos):**
- ✅ Criar demands (agendar consultas/atendimentos)
- ✅ Visualizar todas as demands da unit
- ✅ Alterar status das demands:
  - `PENDING` → `CHECK_IN` (fazer check-in do paciente)
  - `PENDING` → `IN_PROGRESS` (iniciar atendimento)
  - `PENDING` → `RESOLVED` (concluir atendimento)
  - `CHECK_IN` → `IN_PROGRESS`
  - `IN_PROGRESS` → `RESOLVED`
- ✅ Atribuir demands a médicos específicos
- ❌ **NÃO pode** alterar status para `BILLED`
- ❌ **NÃO pode** alterar status para `REJECTED` (cancelamento automático pelo sistema)

**Usuários:**
- ✅ Pode atribuir atendimentos aos médicos (`assign User`)
- ❌ NÃO pode criar, editar ou deletar usuários

#### Fluxo Típico
1. Paciente chega na clínica
2. Recepcionista faz check-in ou cria novo cadastro
3. Cria demand e atribui ao médico disponível
4. Atualiza status conforme atendimento progride
5. Marca como concluído após consulta

#### Código de Permissão
```typescript
can('get', 'Applicant')
can('create', 'Applicant')
can('create', 'Demand')
can('get', 'Demand')
can('update', 'Demand')
can('assign', 'User')
```

---

### 🩺 **ANALYST** - Médico/Profissional de Saúde

#### Contexto
- Profissional que realiza atendimentos
- Trabalha apenas com demands atribuídas a ele

#### Permissões

**Demands (Atendimentos):**
- ✅ Visualizar **APENAS** demands atribuídas a ele (`member_id = user.id`)
- ✅ Alterar status das demands atribuídas:
  - `CHECK_IN` → `IN_PROGRESS` (iniciar atendimento)
  - `IN_PROGRESS` → `RESOLVED` (concluir atendimento)
- ❌ **NÃO pode** visualizar demands de outros médicos
- ❌ **NÃO pode** criar demands
- ❌ **NÃO pode** alterar status para `REJECTED`
- ❌ **NÃO pode** alterar status para `BILLED`

**Applicants (Pacientes):**
- ❌ **NÃO visualiza** applicants diretamente
- ℹ️ Pode ver informações do paciente dentro da demand

#### Fluxo Típico
1. Médico acessa o sistema
2. Visualiza lista de atendimentos atribuídos a ele
3. Seleciona próximo paciente (status CHECK_IN)
4. Inicia atendimento (muda para IN_PROGRESS)
5. Após consulta, marca como concluído (RESOLVED)

#### Código de Permissão
```typescript
can('get', 'Demand', { memberId: { $eq: user.id } })
can('update', 'Demand', { memberId: { $eq: user.id } })
```

---

### 💰 **BILLING** - Faturista

#### Contexto
- Responsável pelo faturamento dos atendimentos
- Trabalha principalmente com atendimentos concluídos

#### Permissões

**Demands (Atendimentos):**
- ✅ Visualizar **TODAS** as demands da unit
- ✅ Alterar status de demands:
  - `RESOLVED` → `BILLED` (faturar atendimento concluído)
- ❌ **NÃO pode** alterar outros status
- ℹ️ No frontend, demands com status `RESOLVED` devem aparecer em **primeira posição** na listagem

**Applicants (Pacientes):**
- ✅ Visualizar informações dos pacientes da unit
- ℹ️ Necessário para dados de faturamento e nota fiscal

**Billing (Faturamento):**
- ✅ Gerenciar funcionalidades de faturamento (`manage Billing`)
- ✅ Gerar relatórios financeiros
- ✅ Emitir documentos fiscais

#### Fluxo Típico
1. Faturista acessa lista de atendimentos
2. Visualiza atendimentos com status RESOLVED em destaque
3. Verifica dados do paciente e do atendimento
4. Processa faturamento
5. Altera status para BILLED
6. Gera nota fiscal/recibo

#### Código de Permissão
```typescript
can('get', 'Applicant')
can('get', 'Demand')
can('update', 'Demand')
can('manage', 'Billing')
```

---

## 🔄 Fluxo de Status das Demands

```
┌─────────┐
│ PENDING │ ──────┐
└─────────┘       │
                  │ Recepcionista cria demand
                  ▼
             ┌──────────┐
             │ CHECK_IN │ ────┐
             └──────────┘     │ Recepcionista faz check-in
                              ▼
                         ┌─────────────┐
                         │ IN_PROGRESS │ ────┐
                         └─────────────┘     │ Médico inicia atendimento
                                             ▼
                                        ┌──────────┐
                                        │ RESOLVED │ ────┐
                                        └──────────┘     │ Médico conclui
                                                         ▼
                                                    ┌────────┐
                                                    │ BILLED │
                                                    └────────┘
                                                         ▲
                                                         │ Faturista processa
                                                         
┌──────────┐
│ REJECTED │ ◄── Cancelamento automático pelo sistema
└──────────┘
```

### Quem pode alterar cada status:

| De → Para | ADMIN | MANAGER | CLERK | ANALYST | BILLING |
|-----------|-------|---------|-------|---------|---------|
| `PENDING` → `CHECK_IN` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `PENDING` → `IN_PROGRESS` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `CHECK_IN` → `IN_PROGRESS` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `IN_PROGRESS` → `RESOLVED` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `RESOLVED` → `BILLED` | ✅ | ❌ | ❌ | ❌ | ✅ |
| Qualquer → `REJECTED` | ❌ | ❌ | ❌ | ❌ | ❌ |

⚠️ **Nota**: `REJECTED` é definido automaticamente pelo sistema, não manualmente.

---

## 🏥 Escopo por Unidade

### Organizações e Unidades
- **Organização (Org)**: Empresa/Grupo (ex: Rede de Clínicas XYZ)
- **Unidade (Unit)**: Clínica individual (ex: Filial Centro, Matriz, Clínica Norte)

### Regras de Visibilidade

1. **Cada funcionário** pertence a **UMA unidade**
2. **Funcionários** visualizam **APENAS**:
   - Applicants da sua unit
   - Demands da sua unit
   - Members da sua unit
3. **Exceção**: ADMIN dono da org pode visualizar **tudo**

### Exemplo Prático
```
Organização: Clínicas Saúde Brasil
├── Unidade: Clínica Centro (unit_id: abc-123)
│   ├── Dr. João (ANALYST)
│   ├── Maria (CLERK)
│   └── Ana (BILLING)
│
└── Unidade: Clínica Norte (unit_id: def-456)
    ├── Dr. Pedro (ANALYST)
    └── Julia (CLERK)

🔒 Dr. João (Centro) NÃO vê demands da Clínica Norte
🔒 Julia (Norte) NÃO vê applicants da Clínica Centro
✅ ADMIN da org vê todas as unidades
```

---

## 🛠️ Implementação Técnica

### Arquivo de Permissões
📁 `/src/db/auth/permissions.ts`

### Tecnologias Utilizadas
- **CASL** (CASL Ability): Biblioteca de controle de acesso
- **MongoDB Query**: Para condições de permissão (ex: `{ memberId: { $eq: user.id } }`)
- **Zod**: Validação de schemas e tipos

### Estrutura de Subjects
Os "subjects" são os recursos que podem ser controlados:

- `User` - Usuários/Funcionários
- `Applicant` - Pacientes
- `Demand` - Atendimentos
- `Unit` - Unidades/Clínicas
- `Organization` - Organizações
- `Invite` - Convites
- `Billing` - Faturamento

### Actions (Ações)
- `create` - Criar novo recurso
- `get` - Visualizar/listar recursos
- `update` - Atualizar recurso existente
- `delete` - Deletar recurso
- `manage` - Gerenciar (todas as ações)
- `assign` - Atribuir (específico para usuários)
- `transfer_ownership` - Transferir propriedade

---

## 📋 Checklist de Implementação Frontend

### Para cada tela/funcionalidade:

- [ ] Verificar role do usuário logado
- [ ] Mostrar/ocultar botões conforme permissões
- [ ] Validar ações antes de enviar ao backend
- [ ] Filtrar listagens por unidade
- [ ] Implementar mensagens de erro amigáveis
- [ ] Adicionar tooltips explicando restrições

### Exemplo de Verificação no Frontend
```typescript
// Verificar se pode criar applicant
if (userRole === 'MANAGER' || userRole === 'CLERK') {
  showCreateApplicantButton()
}

// Verificar se pode alterar status para BILLED
if (userRole === 'BILLING' && demand.status === 'RESOLVED') {
  showBillButton()
}

// Médico vê apenas suas demands
if (userRole === 'ANALYST') {
  demands = demands.filter(d => d.member_id === userId)
}
```

---

## 🔐 Segurança e Boas Práticas

1. **Nunca confie apenas no frontend**: Sempre validar permissões no backend
2. **Use condições específicas**: Ex: `{ memberId: { $eq: user.id } }` para limitar acesso
3. **Logs de auditoria**: Registre quem alterou o quê
4. **Princípio do menor privilégio**: Dê apenas as permissões necessárias
5. **Revisão periódica**: Revise permissões quando cargos mudarem

---

## 📞 Suporte

Para dúvidas sobre permissões ou sugestões de melhorias, consulte a equipe de desenvolvimento.

---

**Última atualização**: 24 de outubro de 2025
**Versão**: 1.0.0
