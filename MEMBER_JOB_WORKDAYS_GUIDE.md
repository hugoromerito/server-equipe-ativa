# 📋 Rotas para Gerenciar Membros - Job Titles e Dias de Trabalho

## 🎯 Resumo

Existem **2 rotas** para gerenciar informações de membros (funcionários):

1. **Atribuir/Atualizar Cargo** (Job Title)
2. **Definir Dias de Trabalho**

---

## 1️⃣ Atribuir Cargo ao Membro

### Endpoint
```http
PATCH /organizations/:organizationSlug/members/:memberId/job-title
```

### Descrição
Atribui um cargo/função específico a um membro da organização.

### Autenticação
✅ Requerida - Bearer Token

### Permissões
- ✅ ADMIN ou MANAGER podem atribuir cargos
- ❌ CLERK, ANALYST, BILLING não podem

### Parâmetros de URL
- `organizationSlug` - Slug da organização (ex: "casa", "ubs-central")
- `memberId` - UUID do membro

### Body (JSON)
```json
{
  "jobTitleId": "uuid-do-cargo" // ou null para remover
}
```

### Exemplo de Requisição
```http
PATCH http://localhost:3333/organizations/casa/members/a1b2c3d4-e5f6-7890-abcd-ef1234567890/job-title
Authorization: Bearer seu-token-jwt
Content-Type: application/json

{
  "jobTitleId": "f9e8d7c6-b5a4-3210-9876-543210abcdef"
}
```

### Resposta de Sucesso (200)
```json
{
  "member": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "jobTitleId": "f9e8d7c6-b5a4-3210-9876-543210abcdef",
    "jobTitleName": "Psicólogo"
  }
}
```

### Remover Cargo
```json
{
  "jobTitleId": null
}
```

---

## 2️⃣ Definir Dias de Trabalho

### Endpoint
```http
PATCH /organizations/:organizationSlug/members/:memberId/working-days
```

### Descrição
Define em quais dias da semana o membro trabalha.

### Autenticação
✅ Requerida - Bearer Token

### Permissões
- ✅ ADMIN ou MANAGER podem definir dias de trabalho
- ❌ CLERK, ANALYST, BILLING não podem

### Parâmetros de URL
- `organizationSlug` - Slug da organização
- `memberId` - UUID do membro

### Body (JSON)
```json
{
  "workingDays": [1, 2, 3, 4, 5] // ou null para trabalhar todos os dias
}
```

### Dias da Semana
- `0` = Domingo
- `1` = Segunda-feira
- `2` = Terça-feira
- `3` = Quarta-feira
- `4` = Quinta-feira
- `5` = Sexta-feira
- `6` = Sábado

### Exemplo de Requisição
```http
PATCH http://localhost:3333/organizations/casa/members/a1b2c3d4-e5f6-7890-abcd-ef1234567890/working-days
Authorization: Bearer seu-token-jwt
Content-Type: application/json

{
  "workingDays": [1, 2, 3, 4, 5]
}
```

### Resposta de Sucesso (204)
```
No Content
```

### Exemplos de Uso

#### Trabalha de segunda a sexta
```json
{
  "workingDays": [1, 2, 3, 4, 5]
}
```

#### Trabalha terças, quintas e sábados
```json
{
  "workingDays": [2, 4, 6]
}
```

#### Trabalha todos os dias (sem restrição)
```json
{
  "workingDays": null
}
```

---

## 📖 Fluxo Completo de Uso

### Passo 1: Autenticar
```http
POST http://localhost:3333/sessions/password
Content-Type: application/json

{
  "email": "hugoxvida@gmail.com",
  "password": "12345678"
}
```

**Resposta:**
```json
{
  "token": "eyJhbGc..."
}
```

### Passo 2: Criar um Cargo (se necessário)
```http
POST http://localhost:3333/organizations/casa/job-titles
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "Psicólogo",
  "description": "Atendimento psicológico"
}
```

**Resposta:**
```json
{
  "jobTitleId": "f9e8d7c6-b5a4-3210-9876-543210abcdef",
  "jobTitle": {
    "id": "f9e8d7c6-b5a4-3210-9876-543210abcdef",
    "name": "Psicólogo",
    ...
  }
}
```

### Passo 3: Obter ID do Membro
```http
GET http://localhost:3333/organizations/casa/members
Authorization: Bearer eyJhbGc...
```

### Passo 4: Atribuir Cargo ao Membro
```http
PATCH http://localhost:3333/organizations/casa/members/a1b2c3d4.../job-title
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "jobTitleId": "f9e8d7c6-b5a4-3210-9876-543210abcdef"
}
```

### Passo 5: Definir Dias de Trabalho
```http
PATCH http://localhost:3333/organizations/casa/members/a1b2c3d4.../working-days
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "workingDays": [1, 2, 3, 4, 5]
}
```

---

## 🔍 Consultar Membros Disponíveis

Após configurar cargo e dias de trabalho, você pode consultar disponibilidade:

```http
GET http://localhost:3333/organizations/casa/units/unidade-1/members/available?date=2025-10-20&time=13:00&category=PSYCHOLOGIST
Authorization: Bearer eyJhbGc...
```

**Resposta:**
```json
{
  "members": [
    {
      "id": "a1b2c3d4...",
      "name": "João Silva",
      "jobTitleId": "f9e8d7c6...",
      "jobTitleName": "Psicólogo",
      "workingDays": [1, 2, 3, 4, 5],
      "hasConflict": false,
      "conflictedAppointments": []
    }
  ]
}
```

---

## ❌ Erros Comuns

### 401 - Não autorizado
```json
{
  "error": "Você não tem permissão para atualizar membros."
}
```
**Solução:** Usuário precisa ter role ADMIN ou MANAGER

### 404 - Membro não encontrado
```json
{
  "error": "Membro não encontrado."
}
```
**Solução:** Verifique se o `memberId` está correto

### 400 - Cargo inválido
```json
{
  "error": "Cargo não encontrado ou não pertence a esta organização."
}
```
**Solução:** Verifique se o `jobTitleId` existe e pertence à organização

---

## 📝 Resumo Visual

```
┌─────────────────────────────────────────┐
│  1. Criar Cargo (Job Title)             │
│     POST /organizations/:slug/job-titles│
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Atribuir Cargo ao Membro            │
│     PATCH /organizations/:slug/         │
│           members/:id/job-title         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Definir Dias de Trabalho            │
│     PATCH /organizations/:slug/         │
│           members/:id/working-days      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Consultar Disponibilidade           │
│     GET /organizations/:slug/units/     │
│         :unitSlug/members/available     │
└─────────────────────────────────────────┘
```

---

## 🎯 Credenciais de Teste

```
Email: hugoxvida@gmail.com
Senha: 12345678
```

---

## 📚 Documentação Relacionada

- Veja `api.http` para exemplos completos
- Documentação Swagger: http://localhost:3333/docs
- Guia de Job Titles: `JOB_TITLES_GUIDE.md`
