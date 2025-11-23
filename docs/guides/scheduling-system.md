# Sistema de Agendamento de Demandas

## Visão Geral

O sistema de agendamento permite gerenciar a disponibilidade de profissionais e agendar demandas considerando:
- **Dias de trabalho** de cada profissional
- **Horários agendados** (data e hora)
- **Categoria profissional** (ex: Psicólogo, Nutricionista, etc.)
- **Conflitos de horário** (mesmo profissional, mesma data/hora)

## Estrutura de Dados

### Members (Profissionais)
```typescript
{
  id: string (UUID)
  user_id: string (UUID)
  job_title_id: string (UUID) | null
  working_days: number[] | null  // [0=Domingo, 1=Segunda, ..., 6=Sábado]
  // ... outros campos
}
```

### Demands (Demandas)
```typescript
{
  id: string (UUID)
  title: string
  description: string
  category: DemandCategory  // PSYCHOLOGIST, NUTRITIONIST, etc.
  scheduled_date: string | null  // Formato: YYYY-MM-DD
  scheduled_time: string | null  // Formato: HH:MM
  responsible_id: string (UUID) | null  // ID do membro responsável
  // ... outros campos
}
```

## Fluxo de Uso

### 1. Configurar Dias de Trabalho do Profissional

**Endpoint:** `PATCH /organizations/:slug/members/:memberId/working-days`

```http
PATCH /organizations/clinica-saude/members/{{memberId}}/working-days
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "workingDays": [1, 2, 5]  // Segunda, Terça e Sexta
}
```

**Dias da Semana:**
- 0 = Domingo
- 1 = Segunda-feira
- 2 = Terça-feira
- 3 = Quarta-feira
- 4 = Quinta-feira
- 5 = Sexta-feira
- 6 = Sábado

**Validações:**
- ✅ Array de números entre 0 e 6
- ✅ Sem dias duplicados
- ✅ Pode ser `null` ou `[]` (trabalha todos os dias)

### 2. Buscar Profissionais Disponíveis

**Endpoint:** `GET /organizations/:slug/units/:unitSlug/members/available`

```http
GET /organizations/clinica-saude/units/unidade-central/members/available?date=2025-10-20&time=13:00&category=PSYCHOLOGIST
Authorization: Bearer {{token}}
```

**Query Parameters:**
- `date` (obrigatório): Data no formato YYYY-MM-DD
- `time` (obrigatório): Hora no formato HH:MM
- `category` (opcional): Categoria profissional

**Resposta:**
```json
{
  "availableMembers": [
    {
      "id": "uuid-member-1",
      "userId": "uuid-user-1",
      "userName": "Paula Silva",
      "userEmail": "paula@example.com",
      "userAvatarUrl": "https://...",
      "jobTitleId": "uuid-job-1",
      "jobTitleName": "Psicóloga",
      "workingDays": [1, 2, 5],  // Segunda, Terça, Sexta
      "hasConflict": false  // ✅ Disponível neste horário
    },
    {
      "id": "uuid-member-2",
      "userName": "Marcos Santos",
      "workingDays": [1, 2, 5],
      "hasConflict": true  // ❌ Já tem outro agendamento neste horário
    }
  ],
  "searchCriteria": {
    "date": "2025-10-20",
    "time": "13:00",
    "dayOfWeek": 1,
    "dayOfWeekName": "Segunda-feira",
    "category": "PSYCHOLOGIST"
  }
}
```

**Lógica de Filtragem:**
1. Busca todos os membros da unidade
2. Filtra por categoria (se especificada)
3. Filtra por dia da semana (`working_days`)
4. Verifica conflitos de horário
5. Ordena: membros sem conflito primeiro

### 3. Criar Demanda com Agendamento

**Endpoint:** `POST /organizations/:slug/units/:unitSlug/applicants/:applicantId/demands`

```http
POST /organizations/clinica-saude/units/unidade-central/applicants/{{applicantId}}/demands
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "title": "Consulta Psicológica",
  "description": "Paciente necessita de atendimento psicológico para ansiedade",
  "scheduledDate": "2025-10-20",
  "scheduledTime": "13:00",
  "responsibleId": "uuid-member-1"  // Paula Silva
}
```

**Validações Automáticas:**
- ✅ Se `scheduledDate` fornecido → `scheduledTime` obrigatório
- ✅ Se `scheduledTime` fornecido → `scheduledDate` obrigatório
- ✅ `responsibleId` deve existir na unidade
- ✅ Categoria e prioridade classificadas automaticamente por IA

**Campos Removidos:**
- ❌ `zip_code`, `state`, `city`, `street`, `neighborhood`, `complement`, `number`

## Exemplos de Cenários

### Cenário 1: Três Psicólogos com Disponibilidades Diferentes

**Configuração:**
```javascript
// Paula - Segunda, Terça, Sexta
PATCH /members/paula-id/working-days
{ "workingDays": [1, 2, 5] }

// Marcos - Segunda, Terça, Sexta
PATCH /members/marcos-id/working-days
{ "workingDays": [1, 2, 5] }

// André - Apenas Quarta
PATCH /members/andre-id/working-days
{ "workingDays": [3] }
```

**Busca para Segunda-feira 13:00:**
```http
GET /members/available?date=2025-10-20&time=13:00&category=PSYCHOLOGIST
```

**Resultado:**
- ✅ Paula (disponível, sem conflito)
- ✅ Marcos (disponível, sem conflito)
- ❌ André (não trabalha às segundas)

**Busca para Quarta-feira 13:00:**
```http
GET /members/available?date=2025-10-22&time=13:00&category=PSYCHOLOGIST
```

**Resultado:**
- ❌ Paula (não trabalha às quartas)
- ❌ Marcos (não trabalha às quartas)
- ✅ André (disponível, sem conflito)

### Cenário 2: Gerenciamento de Conflitos

**Estado Inicial:**
- Paula tem agendamento às 13:00 de segunda
- Marcos está livre

**Busca:**
```http
GET /members/available?date=2025-10-20&time=13:00&category=PSYCHOLOGIST
```

**Resultado:**
```json
{
  "availableMembers": [
    {
      "userName": "Marcos Santos",
      "hasConflict": false  // ✅ Aparece primeiro
    },
    {
      "userName": "Paula Silva",
      "hasConflict": true   // ⚠️ Aparece depois
    }
  ]
}
```

**Interpretação:**
- Marcos é a primeira opção (sem conflito)
- Paula ainda aparece na lista (pode escolher mesmo com conflito)
- Sistema não bloqueia, apenas informa

## Boas Práticas

### ✅ Recomendado

1. **Sempre consultar disponibilidade antes de agendar**
   ```javascript
   // 1. Buscar disponíveis
   const available = await getAvailableMembers(date, time, category)
   
   // 2. Escolher profissional sem conflito
   const professional = available.find(m => !m.hasConflict)
   
   // 3. Criar demanda
   await createDemand({ responsibleId: professional.id, ... })
   ```

2. **Configurar working_days para todos os profissionais**
   - Evita assumir que trabalham todos os dias
   - Melhora precisão da busca de disponibilidade

3. **Sempre fornecer date + time juntos**
   - Validação automática garante consistência

### ❌ Evitar

1. **Criar demanda sem consultar disponibilidade**
   - Pode gerar conflitos
   - Profissional pode não trabalhar no dia

2. **Deixar working_days vazio para profissionais com escala**
   - Sistema assume que trabalham todos os dias
   - Resultados de busca imprecisos

3. **Fornecer apenas data ou apenas hora**
   - API retornará erro de validação

## Migrações Aplicadas

### Migração 0005 (chemical_newton_destine)
```sql
-- Adicionar campos de agendamento em demands
ALTER TABLE "demands" ADD COLUMN "scheduled_date" date;
ALTER TABLE "demands" ADD COLUMN "scheduled_time" time;
ALTER TABLE "demands" ADD COLUMN "responsible_id" uuid;

-- Adicionar dias de trabalho em members
ALTER TABLE "members" ADD COLUMN "working_days" integer[];

-- Constraints
ALTER TABLE "demands" 
  ADD CONSTRAINT "demands_responsible_id_members_id_fk" 
  FOREIGN KEY ("responsible_id") 
  REFERENCES "public"."members"("id") 
  ON DELETE SET NULL;

-- Remover campos de endereço
ALTER TABLE "demands" DROP COLUMN "zip_code";
ALTER TABLE "demands" DROP COLUMN "state";
ALTER TABLE "demands" DROP COLUMN "city";
ALTER TABLE "demands" DROP COLUMN "street";
ALTER TABLE "demands" DROP COLUMN "neighborhood";
ALTER TABLE "demands" DROP COLUMN "complement";
ALTER TABLE "demands" DROP COLUMN "number";
```

## Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/organizations/:slug/members/:memberId/working-days` | Atualizar dias de trabalho |
| `GET` | `/organizations/:slug/units/:unitSlug/members/available` | Buscar profissionais disponíveis |
| `POST` | `/organizations/:slug/units/:unitSlug/applicants/:applicantId/demands` | Criar demanda (atualizado) |

## Categorias Profissionais

```typescript
enum DemandCategory {
  SOCIAL_WORKER = 'SOCIAL_WORKER',
  PSYCHOMOTOR_PHYSIOTHERAPIST = 'PSYCHOMOTOR_PHYSIOTHERAPIST',
  SPEECH_THERAPIST = 'SPEECH_THERAPIST',
  MUSIC_THERAPIST = 'MUSIC_THERAPIST',
  NEUROPSYCHOPEDAGOGUE = 'NEUROPSYCHOPEDAGOGUE',
  NEUROPSYCHOLOGIST = 'NEUROPSYCHOLOGIST',
  NUTRITIONIST = 'NUTRITIONIST',
  PSYCHOLOGIST = 'PSYCHOLOGIST',
  PSYCHOMOTRICIAN = 'PSYCHOMOTRICIAN',
  PSYCHOPEDAGOGUE = 'PSYCHOPEDAGOGUE',
  THERAPIST = 'THERAPIST',
  OCCUPATIONAL_THERAPIST = 'OCCUPATIONAL_THERAPIST'
}
```

## Troubleshooting

### Problema: Profissional não aparece na busca de disponibilidade

**Possíveis causas:**
1. `working_days` não inclui o dia da semana buscado
2. Categoria não corresponde ao `job_title`
3. Profissional não está vinculado à unidade

**Solução:**
```javascript
// Verificar working_days
GET /organizations/:slug/members/:memberId

// Atualizar se necessário
PATCH /organizations/:slug/members/:memberId/working-days
{ "workingDays": [0, 1, 2, 3, 4, 5, 6] }  // Todos os dias
```

### Problema: Validação falha ao criar demanda

**Erro:** "Hora de agendamento é obrigatória quando data é fornecida"

**Solução:**
```json
{
  "scheduledDate": "2025-10-20",
  "scheduledTime": "13:00"  // ✅ Ambos obrigatórios
}
```

### Problema: `hasConflict` sempre `true`

**Causa:** Profissional já tem outro agendamento no mesmo horário

**Solução:**
1. Escolher outro profissional disponível (hasConflict: false)
2. Escolher outro horário
3. Cancelar/reagendar o agendamento conflitante

## Segurança e Permissões

- ✅ Todos os endpoints requerem autenticação (`Bearer Token`)
- ✅ Usuário deve ser membro da organização/unidade
- ✅ Permissões baseadas em roles (ADMIN, MANAGER, CLERK, etc.)
- ✅ Validações de FK garantem integridade referencial

## Performance

**Otimizações implementadas:**
- Índices em `scheduled_date` e `scheduled_time` (considerar adicionar)
- Query com `LIMIT 1` para buscas únicas
- LEFT JOIN para job_titles (opcional)
- Filtragem em memória após busca (small dataset)

**Recomendações futuras:**
- Adicionar índice composto: `(scheduled_date, scheduled_time, responsible_id)`
- Cache de membros por unidade (Redis)
- Paginação para unidades grandes (>100 membros)
