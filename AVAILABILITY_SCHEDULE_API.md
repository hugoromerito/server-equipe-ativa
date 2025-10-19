# 📅 API de Agenda Completa de Disponibilidade

A nova rota `/organizations/:slug/units/:unitSlug/members/availability-schedule` retorna todos os horários disponíveis de uma vez, criando uma grade completa de disponibilidade.

## 🚀 Endpoint

```http
GET /organizations/{organizationSlug}/units/{unitSlug}/members/availability-schedule
```

## 📋 Parâmetros

### Query Parameters (todos opcionais):

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `startDate` | string | hoje | Data de início (YYYY-MM-DD) |
| `days` | number | 7 | Número de dias (1-30) |
| `startHour` | number | 8 | Hora inicial (0-23) |
| `endHour` | number | 18 | Hora final (0-23) |
| `intervalMinutes` | number | 30 | Intervalo em minutos (15-120) |
| `jobTitleId` | string | - | Filtrar por cargo específico (UUID) |

## 💡 Exemplos de Uso

### 1. Agenda da Semana (Padrão)
```http
GET /organizations/clinica-exemplo/units/psicologia/members/availability-schedule
```

### 2. Agenda Personalizada
```http
GET /organizations/clinica-exemplo/units/psicologia/members/availability-schedule?startDate=2025-10-20&days=14&startHour=9&endHour=17&intervalMinutes=60
```

### 3. Filtrar por Profissão
```http
GET /organizations/clinica-exemplo/units/psicologia/members/availability-schedule?jobTitleId=uuid-psicologo&days=5
```

## 📊 Resposta

```json
{
  "schedule": {
    "dates": ["2025-10-20", "2025-10-21", "2025-10-22", "..."],
    "timeSlots": ["08:00", "08:30", "09:00", "09:30", "..."],
    "members": [
      {
        "id": "uuid-profissional-1",
        "name": "Dr. João Silva",
        "email": "joao@clinica.com",
        "jobTitle": "Psicólogo",
        "jobTitleId": "uuid-psicologo",
        "workingDays": ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"],
        "availability": {
          "2025-10-20": {
            "08:00": { "available": true, "reason": "available" },
            "08:30": { "available": true, "reason": "available" },
            "09:00": { "available": false, "reason": "conflict", "conflictingDemandId": "uuid-demanda" },
            "09:30": { "available": true, "reason": "available" }
          },
          "2025-10-21": {
            "08:00": { "available": false, "reason": "not-working-day" }
          }
        }
      }
    ]
  },
  "metadata": {
    "startDate": "2025-10-20",
    "days": 7,
    "startHour": 8,
    "endHour": 18,
    "intervalMinutes": 30,
    "totalSlots": 140,
    "jobTitleId": "uuid-psicologo"
  }
}
```

## 🔧 Status de Disponibilidade

| Status | Descrição |
|--------|-----------|
| `available` | ✅ Horário livre para agendamento |
| `conflict` | ❌ Já tem agendamento neste horário |
| `not-working-day` | ❌ Profissional não trabalha neste dia |
| `outside-hours` | ❌ Fora do horário de funcionamento |

## 🎯 Vantagens

1. **📈 Performance**: Uma única requisição ao invés de múltiplas
2. **🗓️ Visão Completa**: Grade completa de disponibilidade
3. **⚡ Flexibilidade**: Configuração personalizável de período e intervalos
4. **🔍 Filtros**: Por profissão ou profissional específico
5. **📊 Rica em Dados**: Inclui motivos da indisponibilidade
6. **🏥 Interface Amigável**: Perfeita para criar calendários visuais

## 🖥️ Exemplo de Interface

Com essa resposta você pode criar:

- **📅 Calendário Visual** - Grid de disponibilidade
- **📋 Lista de Horários** - Agrupados por profissional
- **🔄 Agendamento Rápido** - Seleção direta de slots livres
- **📊 Dashboard** - Estatísticas de ocupação

## ⚡ Performance

- Otimizada para períodos de até 30 dias
- Cache de conflitos em memória
- Processamento batch de disponibilidade
- Resposta típica: < 500ms para 1 semana com 10 profissionais

## 🔒 Segurança

- Autenticação JWT obrigatória
- Verificação de permissões na organização/unidade
- Validação de todos os parâmetros de entrada
- Rate limiting aplicável

Esta nova API revoluciona a experiência de agendamento, permitindo interfaces muito mais ricas e responsivas! 🚀