# 🏥 Sistema de Agendamento de Demandas - Implementação Completa

Este documento descreve o sistema de agendamento implementado que funciona como uma clínica médica, onde profissionais não podem atender duas demandas no mesmo horário.

## 📋 Funcionalidades Implementadas

### ✅ 1. Validação de Conflitos de Horário
- **Arquivo**: `src/http/utils/schedule-validation.ts`
- **Função**: `validateMemberScheduling()`
- **Descrição**: Verifica se um profissional já possui agendamento no mesmo horário

### ✅ 2. Criação de Demandas com Agendamento
- **Arquivo**: `src/http/routes/demands/create-demand.ts`
- **Endpoint**: `POST /organizations/:organizationSlug/units/:unitSlug/applicants/:applicantSlug/demands`
- **Campos adicionais**:
  - `scheduledDate` (YYYY-MM-DD)
  - `scheduledTime` (HH:MM)
  - `responsibleId` (UUID do profissional)

### ✅ 3. Atualização de Demandas com Validação
- **Arquivo**: `src/http/routes/demands/update-demand.ts`
- **Endpoint**: `PATCH /organizations/:organizationSlug/units/:unitSlug/demands/:demandId`
- **Validação**: Impede conflitos ao alterar horários/profissionais

### ✅ 4. Atribuição de Profissional a Demanda
- **Arquivo**: `src/http/routes/demands/assign-member.ts`
- **Endpoint**: `PATCH /organizations/:organizationSlug/units/:unitSlug/demands/:demandId/assign`
- **Função**: Atribui profissional e agenda horário para demanda existente

### ✅ 5. Consulta de Profissionais Disponíveis
- **Arquivo**: `src/http/routes/members/get-available-members.ts`
- **Endpoint**: `GET /organizations/:organizationSlug/units/:unitSlug/members/available`
- **Parâmetros**: `date`, `time`, `category` (opcional)
- **Retorna**: Lista de profissionais com indicação de conflitos

### ✅ 6. Agenda de Disponibilidade
- **Arquivo**: `src/http/routes/members/get-schedule-availability.ts`
- **Endpoint**: `GET /organizations/:organizationSlug/units/:unitSlug/members/schedule-availability`
- **Função**: Retorna matriz de disponibilidade por profissional, data e horário

## 🚀 Como Usar o Sistema

### 1. Verificar Profissionais Disponíveis

```http
GET /organizations/clinica-exemplo/units/psicologia/members/available?date=2025-10-20&time=14:00
Authorization: Bearer seu_token_jwt
```

**Resposta:**
```json
{
  "availableMembers": [
    {
      "id": "uuid-profissional-1",
      "userName": "Dr. João Silva",
      "userEmail": "joao@clinica.com",
      "jobTitleName": "Psicólogo",
      "workingDays": ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"],
      "hasConflict": false
    },
    {
      "id": "uuid-profissional-2", 
      "userName": "Dra. Maria Santos",
      "userEmail": "maria@clinica.com",
      "jobTitleName": "Psicólogo",
      "workingDays": ["SEGUNDA", "QUARTA", "SEXTA"],
      "hasConflict": true  // ❌ Já tem agendamento neste horário
    }
  ],
  "searchCriteria": {
    "date": "2025-10-20",
    "time": "14:00",
    "dayOfWeek": 1,
    "dayOfWeekName": "Segunda-feira"
  }
}
```

### 2. Criar Demanda com Agendamento

```http
POST /organizations/clinica-exemplo/units/psicologia/applicants/uuid-paciente/demands
Authorization: Bearer seu_token_jwt
Content-Type: application/json

{
  "title": "Consulta Psicológica",
  "description": "Atendimento psicológico de rotina",
  "scheduledDate": "2025-10-20",
  "scheduledTime": "14:00",
  "responsibleId": "uuid-profissional-1"
}
```

**Resposta de Sucesso:**
```json
{
  "demandId": "uuid-nova-demanda",
  "category": "PSYCHOLOGIST", 
  "priority": "MEDIUM"
}
```

**Resposta de Erro (Conflito):**
```json
{
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "O profissional já possui um agendamento neste horário (2025-10-20 às 14:00)."
}
```

### 3. Atribuir Profissional a Demanda Existente

```http
PATCH /organizations/clinica-exemplo/units/psicologia/demands/uuid-demanda/assign
Authorization: Bearer seu_token_jwt
Content-Type: application/json

{
  "responsibleId": "uuid-profissional-1",
  "scheduledDate": "2025-10-20", 
  "scheduledTime": "15:00"
}
```

**Resposta:**
```json
{
  "demand": {
    "id": "uuid-demanda",
    "title": "Consulta Psicológica",
    "status": "IN_PROGRESS",
    "scheduledDate": "2025-10-20",
    "scheduledTime": "15:00",
    "responsible": {
      "id": "uuid-profissional-1",
      "name": "Dr. João Silva",
      "email": "joao@clinica.com",
      "jobTitle": "Psicólogo"
    }
  },
  "message": "Profissional Dr. João Silva foi atribuído à demanda para 2025-10-20 às 15:00."
}
```

### 4. Visualizar Agenda de Disponibilidade

```http
GET /organizations/clinica-exemplo/units/psicologia/members/schedule-availability?startDate=2025-10-20&days=7&startHour=8&endHour=18
Authorization: Bearer seu_token_jwt
```

**Resposta:**
```json
{
  "schedule": {
    "dates": ["2025-10-20", "2025-10-21", "2025-10-22", "..."],
    "timeSlots": ["08:00", "09:00", "10:00", "...", "17:00"],
    "jobTitles": [
      {
        "id": "uuid-cargo-psicologo",
        "name": "Psicólogo",
        "members": [
          {
            "id": "uuid-profissional-1",
            "userName": "Dr. João Silva",
            "workingDays": ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"],
            "availability": {
              "2025-10-20": {
                "08:00": { "available": true, "reason": "available" },
                "09:00": { "available": true, "reason": "available" },
                "14:00": { "available": false, "reason": "conflict" },
                "15:00": { "available": true, "reason": "available" }
              }
            }
          }
        ]
      }
    ]
  }
}
```

## 🔒 Regras de Negócio Implementadas

### ✅ 1. Prevenção de Conflitos
- Um profissional **NÃO PODE** atender duas demandas no mesmo horário
- Sistema valida automaticamente antes de criar/atualizar agendamentos
- Retorna erro claro quando há tentativa de conflito

### ✅ 2. Dias de Trabalho
- Profissionais têm dias de trabalho configuráveis (`working_days`)
- Sistema impede agendamento em dias que o profissional não trabalha
- Exemplo: Se profissional só trabalha Segunda/Quarta/Sexta, não pode ser agendado na Terça

### ✅ 3. Estados de Demanda
- Demandas agendadas automaticamente mudam status para `IN_PROGRESS`
- Demandas `RESOLVED`, `REJECTED` ou `BILLED` não podem ser reagendadas
- Sistema considera apenas demandas ativas para verificação de conflitos

### ✅ 4. Flexibilidade de Agendamento
- Demandas podem ser criadas sem agendamento inicial
- Profissional pode ser atribuído posteriormente via endpoint `/assign`
- Horários podem ser alterados via `PATCH` com validação de conflitos

## 🧪 Exemplos de Cenários

### ✅ Cenário 1: Agendamento Bem-sucedido
1. Dr. João trabalha Segunda a Sexta
2. Não tem nenhum agendamento às 14h de Segunda
3. ✅ **Resultado**: Agendamento criado com sucesso

### ❌ Cenário 2: Conflito de Horário  
1. Dr. João já tem consulta às 14h de Segunda
2. Tentativa de agendar outra consulta no mesmo horário
3. ❌ **Resultado**: Erro - "já possui um agendamento neste horário"

### ❌ Cenário 3: Dia Não Trabalhado
1. Dra. Maria só trabalha Segunda/Quarta/Sexta
2. Tentativa de agendar na Terça-feira
3. ❌ **Resultado**: Erro - "não trabalha neste dia da semana"

### ✅ Cenário 4: Mesmo Horário, Profissionais Diferentes
1. Dr. João agendado às 14h
2. Dra. Maria também disponível às 14h
3. ✅ **Resultado**: Ambos podem atender no mesmo horário (profissionais diferentes)

## 🏗️ Arquitetura da Solução

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes     │    │   Validation    │
│                 │    │                  │    │                 │
│ - Agenda        │───▶│ - create-demand  │───▶│ - schedule-     │
│ - Busca Profs   │    │ - update-demand  │    │   validation.ts │
│ - Atribuição    │    │ - assign-member  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                         │
                                ▼                         ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Database      │    │   Business      │
                       │                 │    │   Logic         │
                       │ - demands       │    │                 │
                       │ - members       │    │ - Conflict      │
                       │ - working_days  │    │   Detection     │
                       │                 │    │ - Working Days  │
                       └─────────────────┘    │ - Status Rules  │
                                              └─────────────────┘
```

## 🎯 Resumo dos Benefícios

1. **🚫 Zero Conflitos**: Sistema garante que profissionais não tenham duplo agendamento
2. **📅 Flexibilidade**: Agendamento pode ser feito na criação ou posteriormente  
3. **👥 Multi-profissional**: Vários profissionais podem atender no mesmo horário
4. **⏰ Dias de Trabalho**: Respeita disponibilidade de cada profissional
5. **🔍 Visibilidade**: APIs para consultar disponibilidade em tempo real
6. **🎛️ Controle**: Atualizações com validação automática de conflitos

O sistema está **100% funcional** e pronto para uso em produção! 🚀