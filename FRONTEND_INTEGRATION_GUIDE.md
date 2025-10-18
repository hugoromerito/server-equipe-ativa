# 📋 Guia de Integração Frontend - Atualizações do Sistema

**Data:** 18 de Outubro de 2025  
**Versão da API:** 1.0.0  
**Ambiente:** Production Ready

---

## 📑 Índice

1. [Visão Geral das Mudanças](#visão-geral)
2. [Breaking Changes](#breaking-changes)
3. [Novas Funcionalidades](#novas-funcionalidades)
4. [Schemas e TypeScript Types](#schemas-typescript)
5. [Exemplos de Requisições](#exemplos-requisições)
6. [Fluxos de Uso](#fluxos-de-uso)
7. [Validações e Regras de Negócio](#validações)
8. [Tratamento de Erros](#erros)

---

## 🎯 Visão Geral das Mudanças {#visão-geral}

### Resumo Executivo
Esta atualização introduz um **sistema completo de agendamento** para gerenciar a disponibilidade de profissionais e **sistema de cargos/funções** para melhor organização dos membros.

### Principais Mudanças

| Categoria | Descrição | Impacto |
|-----------|-----------|---------|
| 🆕 **Job Titles** | Sistema de cargos/funções | NOVO |
| 🆕 **Agendamento** | Dias de trabalho + disponibilidade | NOVO |
| ⚠️ **Demands** | Campos de endereço removidos | BREAKING |
| ✨ **Demands** | Campos de agendamento adicionados | NOVO |
| ✨ **Members** | Campo working_days adicionado | NOVO |
| ✨ **Enums** | Novas categorias profissionais | ATUALIZADO |

---

## 🚨 Breaking Changes {#breaking-changes}

### 1. ❌ **Demands: Campos de Endereço Removidos**

#### Campos Deletados da Tabela `demands`
```typescript
// ❌ REMOVIDOS - Não enviar mais estes campos
interface DemandOLD {
  zip_code: string | null
  state: string | null
  city: string | null
  street: string | null
  neighborhood: string | null
  complement: string | null
  number: string | null
}
```

#### ⚠️ Ação Necessária
```typescript
// ❌ ANTES (não funciona mais)
const demandData = {
  title: "Consulta",
  description: "Descrição",
  zip_code: "12345-678",
  state: "SP",
  city: "São Paulo",
  street: "Rua ABC",
  // ...
}

// ✅ AGORA (correto)
const demandData = {
  title: "Consulta",
  description: "Descrição",
  // Campos de endereço removidos - usar endereço do applicant
}
```

#### 📍 Onde Buscar Endereço Agora?
O endereço está no **Applicant**, não na Demand:
```typescript
GET /organizations/:slug/applicants/:id

// Response inclui endereço completo do applicant
{
  "applicant": {
    "id": "uuid",
    "name": "João Silva",
    "zip_code": "12345-678",
    "state": "SP",
    "city": "São Paulo",
    "street": "Rua ABC",
    // ...
  }
}
```

---

### 2. ⚠️ **Demand Categories: Valores Atualizados**

#### Novas Categorias Profissionais
```typescript
// ❌ ANTIGAS (removidas)
'CATEGORY_1', 'CATEGORY_2', 'CATEGORY_3', ...

// ✅ NOVAS (usar estas)
type DemandCategory = 
  | 'SOCIAL_WORKER'                    // Assistente Social
  | 'PSYCHOMOTOR_PHYSIOTHERAPIST'      // Fisioterapeuta Psicomotor
  | 'SPEECH_THERAPIST'                 // Fonoaudiólogo
  | 'MUSIC_THERAPIST'                  // Musicoterapeuta
  | 'NEUROPSYCHOPEDAGOGUE'             // Neuropsicopedagogo
  | 'NEUROPSYCHOLOGIST'                // Neuropsicólogo
  | 'NUTRITIONIST'                     // Nutricionista
  | 'PSYCHOLOGIST'                     // Psicólogo
  | 'PSYCHOMOTRICIAN'                  // Psicomotricista
  | 'PSYCHOPEDAGOGUE'                  // Psicopedagogo
  | 'THERAPIST'                        // Terapeuta
  | 'OCCUPATIONAL_THERAPIST'           // Terapeuta Ocupacional
```

#### Mapeamento de Traduções
```typescript
const categoryLabels: Record<DemandCategory, string> = {
  'SOCIAL_WORKER': 'Assistente Social',
  'PSYCHOMOTOR_PHYSIOTHERAPIST': 'Fisioterapeuta Psicomotor',
  'SPEECH_THERAPIST': 'Fonoaudiólogo(a)',
  'MUSIC_THERAPIST': 'Musicoterapeuta',
  'NEUROPSYCHOPEDAGOGUE': 'Neuropsicopedagogo(a)',
  'NEUROPSYCHOLOGIST': 'Neuropsicólogo(a)',
  'NUTRITIONIST': 'Nutricionista',
  'PSYCHOLOGIST': 'Psicólogo(a)',
  'PSYCHOMOTRICIAN': 'Psicomotricista',
  'PSYCHOPEDAGOGUE': 'Psicopedagogo(a)',
  'THERAPIST': 'Terapeuta',
  'OCCUPATIONAL_THERAPIST': 'Terapeuta Ocupacional',
}
```

---

### 3. ✨ **Demand Status: Novo Status BILLED**

#### Novo Status Adicionado
```typescript
type DemandStatus = 
  | 'PENDING'      // Pendente
  | 'IN_PROGRESS'  // Em Progresso
  | 'RESOLVED'     // Resolvida
  | 'REJECTED'     // Rejeitada
  | 'BILLED'       // 🆕 Faturada (novo!)
```

#### Regras de Transição de Status
```typescript
const allowedTransitions = {
  'PENDING': ['IN_PROGRESS', 'REJECTED'],
  'IN_PROGRESS': ['RESOLVED', 'REJECTED', 'PENDING'],
  'RESOLVED': ['BILLED', 'IN_PROGRESS'],
  'REJECTED': ['PENDING', 'IN_PROGRESS'],
  'BILLED': [], // Estado final - não pode mudar
}
```

#### Validação no Frontend
```typescript
function canTransitionTo(currentStatus: DemandStatus, newStatus: DemandStatus): boolean {
  return allowedTransitions[currentStatus].includes(newStatus)
}

// Exemplo de uso
if (canTransitionTo('RESOLVED', 'BILLED')) {
  // Mostrar botão "Faturar"
}
```

---

## 🆕 Novas Funcionalidades {#novas-funcionalidades}

## 1. 📌 Sistema de Job Titles (Cargos/Funções)

### Visão Geral
Sistema para criar e gerenciar cargos/funções específicas dos profissionais, separado das roles de sistema (ADMIN, MANAGER, etc.).

### Estrutura de Dados
```typescript
interface JobTitle {
  id: string                    // UUID
  name: string                  // Ex: "Psicólogo Infantil", "Recepcionista"
  description: string | null    // Descrição do cargo
  organization_id: string       // UUID da organização
  unit_id: string | null        // UUID da unidade (opcional - null = org-wide)
  created_at: Date
  updated_at: Date | null
}
```

### Unique Constraint
⚠️ **Importante:** Não pode haver dois cargos com o mesmo nome na mesma organização/unidade:
```typescript
// ✅ Permitido
{ name: "Recepcionista", organization_id: "org1", unit_id: "unit1" }
{ name: "Recepcionista", organization_id: "org1", unit_id: "unit2" } // Unidade diferente

// ❌ Não permitido (erro 409 Conflict)
{ name: "Recepcionista", organization_id: "org1", unit_id: "unit1" }
{ name: "Recepcionista", organization_id: "org1", unit_id: "unit1" } // Duplicado!
```

### Endpoints Disponíveis

#### 1.1 Criar Job Title
```http
POST /organizations/:slug/job-titles
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Psicólogo Infantil",
  "description": "Especialista em psicologia infantil",
  "unitId": "uuid" // Opcional - null = cargo para toda organização
}
```

**Response 201:**
```json
{
  "jobTitleId": "uuid-do-cargo"
}
```

**Validações:**
- `name`: 2-100 caracteres, obrigatório
- `description`: máximo 500 caracteres, opcional
- `unitId`: UUID válido ou null, opcional
- **Permissão:** `manage:Organization`

---

#### 1.2 Listar Job Titles
```http
GET /organizations/:slug/job-titles?unitId=uuid
Authorization: Bearer {token}
```

**Query Params:**
- `unitId` (opcional): Filtrar por unidade específica

**Response 200:**
```json
{
  "jobTitles": [
    {
      "id": "uuid",
      "name": "Psicólogo Infantil",
      "description": "Especialista em psicologia infantil",
      "organizationId": "uuid",
      "unitId": "uuid",
      "unitName": "Unidade Central",
      "createdAt": "2025-10-18T10:00:00Z",
      "updatedAt": null
    }
  ]
}
```

---

#### 1.3 Buscar Job Title
```http
GET /organizations/:slug/job-titles/:jobTitleId
Authorization: Bearer {token}
```

**Response 200:**
```json
{
  "jobTitle": {
    "id": "uuid",
    "name": "Psicólogo Infantil",
    "description": "Especialista em psicologia infantil",
    "organizationId": "uuid",
    "unitId": "uuid",
    "unitName": "Unidade Central",
    "organizationName": "Clínica Saúde",
    "createdAt": "2025-10-18T10:00:00Z",
    "updatedAt": null
  }
}
```

---

#### 1.4 Atualizar Job Title
```http
PATCH /organizations/:slug/job-titles/:jobTitleId
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Psicólogo Infantil Senior",
  "description": "Especialista com mais de 10 anos de experiência"
}
```

**Response 204:** No Content

**Validações:**
- Ambos os campos são opcionais
- Se fornecido, `name` deve ter 2-100 caracteres
- Se fornecido, `description` máximo 500 caracteres
- **Permissão:** `manage:Organization`

---

#### 1.5 Deletar Job Title
```http
DELETE /organizations/:slug/job-titles/:jobTitleId
Authorization: Bearer {token}
```

**Response 204:** No Content

**Comportamento:**
- Job title é deletado
- Membros com este cargo terão `job_title_id` setado para `null` automaticamente
- **Permissão:** `manage:Organization`

---

### Integração com Members

#### Associar Job Title ao Member
```typescript
// Ao criar/atualizar member via invite
interface Member {
  id: string
  user_id: string
  organization_role: Role
  unit_role: Role | null
  job_title_id: string | null  // 🆕 UUID do cargo
  working_days: number[] | null // 🆕 Dias de trabalho
}
```

#### Listar Members com Job Title
```http
GET /organizations/:slug/units/:unitSlug/members
```

**Response:**
```json
{
  "members": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "name": "Dr. João Silva",
        "email": "joao@example.com"
      },
      "organizationRole": "CLERK",
      "unitRole": "CLERK",
      "jobTitleId": "uuid",           // 🆕
      "jobTitleName": "Psicólogo",    // 🆕
      "workingDays": [1, 2, 3, 4, 5]  // 🆕
    }
  ]
}
```

---

## 2. 📅 Sistema de Agendamento

### Visão Geral
Sistema completo para gerenciar disponibilidade de profissionais e agendar demandas considerando:
- Dias da semana em que cada profissional trabalha
- Horários já agendados (conflitos)
- Categoria profissional

### 2.1 Working Days (Dias de Trabalho)

#### Estrutura
```typescript
interface Member {
  working_days: number[] | null
  // 0 = Domingo
  // 1 = Segunda-feira
  // 2 = Terça-feira
  // 3 = Quarta-feira
  // 4 = Quinta-feira
  // 5 = Sexta-feira
  // 6 = Sábado
}

// Exemplos
working_days: [1, 2, 5]        // Trabalha segunda, terça e sexta
working_days: [1, 2, 3, 4, 5]  // Trabalha seg-sex (dias úteis)
working_days: null             // Trabalha todos os dias
working_days: []               // Trabalha todos os dias (equivalente a null)
```

#### Endpoint: Atualizar Working Days
```http
PATCH /organizations/:slug/members/:memberId/working-days
Authorization: Bearer {token}
Content-Type: application/json

{
  "workingDays": [1, 2, 5]  // Segunda, Terça, Sexta
}
```

**Response 204:** No Content

**Validações:**
- Array de números entre 0 e 6
- Não pode ter dias duplicados
- Pode ser `null` (trabalha todos os dias)
- **Permissão:** `update:User`

**Exemplo de Validação Frontend:**
```typescript
function validateWorkingDays(days: number[] | null): string | null {
  if (days === null) return null
  
  // Verificar range
  if (days.some(d => d < 0 || d > 6)) {
    return "Dias devem estar entre 0 (Domingo) e 6 (Sábado)"
  }
  
  // Verificar duplicatas
  if (new Set(days).size !== days.length) {
    return "Dias não podem estar duplicados"
  }
  
  return null // Válido
}
```

---

### 2.2 Buscar Profissionais Disponíveis

#### Endpoint
```http
GET /organizations/:slug/units/:unitSlug/members/available
Authorization: Bearer {token}

Query Params:
  - date (obrigatório): YYYY-MM-DD
  - time (obrigatório): HH:MM
  - category (opcional): DemandCategory
```

**Exemplo:**
```http
GET /organizations/clinica-saude/units/unidade-central/members/available?date=2025-10-20&time=13:00&category=PSYCHOLOGIST
```

**Response 200:**
```json
{
  "availableMembers": [
    {
      "id": "uuid-member-1",
      "userId": "uuid-user-1",
      "userName": "Paula Silva",
      "userEmail": "paula@example.com",
      "userAvatarUrl": "https://...",
      "jobTitleId": "uuid-job",
      "jobTitleName": "Psicóloga Infantil",
      "workingDays": [1, 2, 5],
      "hasConflict": false  // ✅ Disponível
    },
    {
      "id": "uuid-member-2",
      "userId": "uuid-user-2",
      "userName": "Marcos Santos",
      "userEmail": "marcos@example.com",
      "userAvatarUrl": "https://...",
      "jobTitleId": "uuid-job",
      "jobTitleName": "Psicólogo",
      "workingDays": [1, 2, 5],
      "hasConflict": true   // ⚠️ Já tem agendamento neste horário
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

#### Lógica de Filtragem
1. **Busca membros da unidade**
2. **Filtra por categoria** (se fornecida) - compara com `job_title_name`
3. **Filtra por dia da semana** - verifica se o dia está em `working_days`
4. **Verifica conflitos** - checa se já tem demanda agendada na mesma data/hora
5. **Ordena resultados** - membros sem conflito aparecem primeiro

#### Exemplo de Uso no Frontend
```typescript
// Componente de Agendamento
async function buscarProfissionaisDisponiveis(
  date: string,  // "2025-10-20"
  time: string,  // "13:00"
  category?: string
) {
  const params = new URLSearchParams({ date, time })
  if (category) params.append('category', category)
  
  const response = await api.get(
    `/organizations/${orgSlug}/units/${unitSlug}/members/available?${params}`
  )
  
  return response.data.availableMembers
}

// Renderizar lista
function ProfessionalList({ members }) {
  return (
    <div>
      {members.map(member => (
        <ProfessionalCard
          key={member.id}
          member={member}
          variant={member.hasConflict ? 'warning' : 'default'}
          badge={member.hasConflict ? 'Ocupado' : 'Disponível'}
        />
      ))}
    </div>
  )
}
```

---

### 2.3 Criar Demanda com Agendamento

#### Novos Campos em Demand
```typescript
interface Demand {
  // ... campos existentes
  
  // 🆕 Campos de agendamento
  scheduled_date: string | null    // "2025-10-20" (formato YYYY-MM-DD)
  scheduled_time: string | null    // "13:00" (formato HH:MM)
  responsible_id: string | null    // UUID do member responsável
}
```

#### Endpoint: Criar com Agendamento
```http
POST /organizations/:slug/units/:unitSlug/applicants/:applicantId/demands
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Consulta Psicológica",
  "description": "Paciente necessita de atendimento para ansiedade",
  "scheduledDate": "2025-10-20",
  "scheduledTime": "13:00",
  "responsibleId": "uuid-do-profissional"
}
```

**Response 201:**
```json
{
  "demandId": "uuid",
  "category": "PSYCHOLOGIST",  // Classificado por IA
  "priority": "HIGH"           // Classificado por IA
}
```

**Validações:**
- `scheduledDate` e `scheduledTime` devem vir juntos ou ambos `null`
- Se fornecido `scheduledDate`, `scheduledTime` é obrigatório (e vice-versa)
- `responsibleId` deve existir na unidade
- Formato de data: `YYYY-MM-DD`
- Formato de hora: `HH:MM`

**Exemplo de Validação Frontend:**
```typescript
interface ScheduleFormData {
  scheduledDate: string | null
  scheduledTime: string | null
  responsibleId: string | null
}

function validateSchedule(data: ScheduleFormData): string | null {
  const { scheduledDate, scheduledTime, responsibleId } = data
  
  // Se forneceu data, hora é obrigatória
  if (scheduledDate && !scheduledTime) {
    return "Hora é obrigatória quando data é fornecida"
  }
  
  // Se forneceu hora, data é obrigatória
  if (scheduledTime && !scheduledDate) {
    return "Data é obrigatória quando hora é fornecida"
  }
  
  // Validar formato de data
  if (scheduledDate && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return "Data deve estar no formato YYYY-MM-DD"
  }
  
  // Validar formato de hora
  if (scheduledTime && !/^\d{2}:\d{2}$/.test(scheduledTime)) {
    return "Hora deve estar no formato HH:MM"
  }
  
  return null // Válido
}
```

---

## 📦 Schemas e TypeScript Types {#schemas-typescript}

### Types Completos para Frontend

```typescript
// ============================================
// ENUMS
// ============================================

export type Role = 
  | 'ADMIN' 
  | 'MANAGER' 
  | 'CLERK' 
  | 'ANALYST' 
  | 'BILLING'

export type DemandStatus = 
  | 'PENDING' 
  | 'IN_PROGRESS' 
  | 'RESOLVED' 
  | 'REJECTED'
  | 'BILLED'  // 🆕

export type DemandPriority = 
  | 'LOW' 
  | 'MEDIUM' 
  | 'HIGH' 
  | 'URGENT'

export type DemandCategory = 
  | 'SOCIAL_WORKER'
  | 'PSYCHOMOTOR_PHYSIOTHERAPIST'
  | 'SPEECH_THERAPIST'
  | 'MUSIC_THERAPIST'
  | 'NEUROPSYCHOPEDAGOGUE'
  | 'NEUROPSYCHOLOGIST'
  | 'NUTRITIONIST'
  | 'PSYCHOLOGIST'
  | 'PSYCHOMOTRICIAN'
  | 'PSYCHOPEDAGOGUE'
  | 'THERAPIST'
  | 'OCCUPATIONAL_THERAPIST'

// ============================================
// JOB TITLES
// ============================================

export interface JobTitle {
  id: string
  name: string
  description: string | null
  organizationId: string
  unitId: string | null
  unitName?: string
  organizationName?: string
  createdAt: string
  updatedAt: string | null
}

export interface CreateJobTitleRequest {
  name: string
  description?: string
  unitId?: string
}

export interface UpdateJobTitleRequest {
  name?: string
  description?: string
}

// ============================================
// MEMBERS
// ============================================

export interface Member {
  id: string
  userId: string
  organizationRole: Role
  unitRole: Role | null
  jobTitleId: string | null      // 🆕
  workingDays: number[] | null   // 🆕
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  jobTitle?: {                   // 🆕
    id: string
    name: string
  }
}

export interface UpdateWorkingDaysRequest {
  workingDays: number[] | null
}

export interface AvailableMember {
  id: string
  userId: string
  userName: string
  userEmail: string
  userAvatarUrl: string | null
  jobTitleId: string | null
  jobTitleName: string | null
  workingDays: number[] | null
  hasConflict: boolean
}

export interface AvailableMembersResponse {
  availableMembers: AvailableMember[]
  searchCriteria: {
    date: string
    time: string
    dayOfWeek: number
    dayOfWeekName: string
    category?: string
  }
}

// ============================================
// DEMANDS
// ============================================

export interface Demand {
  id: string
  title: string
  description: string
  status: DemandStatus
  priority: DemandPriority
  category: DemandCategory
  
  // ❌ REMOVIDOS
  // zip_code: string | null
  // state: string | null
  // city: string | null
  // street: string | null
  // neighborhood: string | null
  // complement: string | null
  // number: string | null
  
  // 🆕 NOVOS
  scheduledDate: string | null
  scheduledTime: string | null
  responsibleId: string | null
  
  createdAt: string
  updatedAt: string | null
  author: string | null
  applicantName: string | null
  createdByMemberName: string
}

export interface CreateDemandRequest {
  title: string
  description: string
  scheduledDate?: string      // 🆕
  scheduledTime?: string      // 🆕
  responsibleId?: string      // 🆕
}

export interface UpdateDemandRequest {
  title?: string
  description?: string
  status?: DemandStatus
  scheduledDate?: string      // 🆕
  scheduledTime?: string      // 🆕
  responsibleId?: string      // 🆕
}

// ============================================
// APPLICANTS (inalterado)
// ============================================

export interface Applicant {
  id: string
  name: string
  phone: string
  birthdate: string
  cpf: string
  // Endereço aqui
  zipCode: string | null
  state: string | null
  city: string | null
  street: string | null
  neighborhood: string | null
  complement: string | null
  number: string | null
  // ...
}
```

---

## 💡 Exemplos de Requisições {#exemplos-requisições}

### Fluxo Completo: Criar Agendamento

```typescript
// 1. Criar Job Title (uma vez)
const jobTitle = await api.post(`/organizations/${orgSlug}/job-titles`, {
  name: "Psicólogo Infantil",
  description: "Especialista em atendimento infantil",
  unitId: unitId  // ou null para org-wide
})

// 2. Atualizar dias de trabalho do profissional
await api.patch(
  `/organizations/${orgSlug}/members/${memberId}/working-days`,
  {
    workingDays: [1, 2, 3, 4, 5] // Seg-Sex
  }
)

// 3. Buscar profissionais disponíveis
const { data } = await api.get(
  `/organizations/${orgSlug}/units/${unitSlug}/members/available`,
  {
    params: {
      date: "2025-10-20",
      time: "14:00",
      category: "PSYCHOLOGIST"
    }
  }
)

// 4. Selecionar profissional sem conflito
const available = data.availableMembers.find(m => !m.hasConflict)

// 5. Criar demanda agendada
const demand = await api.post(
  `/organizations/${orgSlug}/units/${unitSlug}/applicants/${applicantId}/demands`,
  {
    title: "Consulta Psicológica",
    description: "Avaliação inicial para ansiedade",
    scheduledDate: "2025-10-20",
    scheduledTime: "14:00",
    responsibleId: available.id
  }
)
```

---

## 🎨 Fluxos de Uso no Frontend {#fluxos-de-uso}

### Fluxo 1: Configurar Profissional

```
1. Admin acessa "Gerenciar Equipe"
2. Clica em "Adicionar Cargo" (Job Title)
   └─> Modal: Nome + Descrição + Unidade (opcional)
   └─> POST /job-titles
3. Clica em "Editar Profissional"
   └─> Seleciona cargo do dropdown (job titles)
   └─> Seleciona dias de trabalho (checkboxes)
   └─> PATCH /members/:id/working-days
4. Salva e profissional está configurado
```

**Componente Sugerido:**
```tsx
function WorkingDaysSelector({ 
  value, 
  onChange 
}: { 
  value: number[] | null
  onChange: (days: number[] | null) => void 
}) {
  const weekDays = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda' },
    { value: 2, label: 'Terça' },
    { value: 3, label: 'Quarta' },
    { value: 4, label: 'Quinta' },
    { value: 5, label: 'Sexta' },
    { value: 6, label: 'Sábado' },
  ]
  
  const handleToggle = (day: number) => {
    if (!value) {
      onChange([day])
      return
    }
    
    if (value.includes(day)) {
      const newDays = value.filter(d => d !== day)
      onChange(newDays.length === 0 ? null : newDays)
    } else {
      onChange([...value, day].sort())
    }
  }
  
  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map(day => (
        <button
          key={day.value}
          type="button"
          onClick={() => handleToggle(day.value)}
          className={
            value?.includes(day.value)
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200'
          }
        >
          {day.label.slice(0, 3)}
        </button>
      ))}
    </div>
  )
}
```

---

### Fluxo 2: Criar Agendamento

```
1. Usuário acessa "Nova Demanda"
2. Preenche título e descrição
3. Clica em "Agendar Atendimento" (opcional)
   └─> Seleciona data (date picker)
   └─> Seleciona hora (time picker)
   └─> Clica em "Buscar Disponíveis"
   └─> GET /members/available?date=...&time=...
4. Sistema mostra lista de profissionais
   └─> Badge verde: "Disponível" (hasConflict: false)
   └─> Badge amarelo: "Ocupado" (hasConflict: true)
5. Seleciona profissional
6. Salva demanda
   └─> POST /demands com scheduledDate, scheduledTime, responsibleId
```

**Componente Sugerido:**
```tsx
function ScheduleDemandForm() {
  const [date, setDate] = useState<string>('')
  const [time, setTime] = useState<string>('')
  const [professionals, setProfessionals] = useState<AvailableMember[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  
  const searchAvailable = async () => {
    const { data } = await api.get(
      `/organizations/${orgSlug}/units/${unitSlug}/members/available`,
      { params: { date, time, category: 'PSYCHOLOGIST' } }
    )
    setProfessionals(data.availableMembers)
  }
  
  return (
    <div>
      <DatePicker value={date} onChange={setDate} />
      <TimePicker value={time} onChange={setTime} />
      
      <button onClick={searchAvailable}>
        Buscar Disponíveis
      </button>
      
      {professionals.map(prof => (
        <ProfessionalCard
          key={prof.id}
          professional={prof}
          selected={selected === prof.id}
          onSelect={() => setSelected(prof.id)}
        />
      ))}
    </div>
  )
}
```

---

### Fluxo 3: Visualizar Agenda

```
1. Admin acessa "Agenda da Unidade"
2. Seleciona data (date picker)
3. Sistema busca todas as demands agendadas para aquela data
   └─> GET /demands?scheduled_date=2025-10-20
4. Renderiza timeline/calendar view
   └─> Agrupa por profissional
   └─> Mostra horários ocupados
   └─> Destaca conflitos
```

**Componente Sugerido:**
```tsx
function AgendaView({ date }: { date: string }) {
  const { data: demands } = useQuery(['demands', date], () =>
    api.get(`/demands?scheduled_date=${date}`)
  )
  
  // Agrupar por profissional
  const byProfessional = groupBy(
    demands?.filter(d => d.responsibleId),
    'responsibleId'
  )
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Object.entries(byProfessional).map(([profId, appointments]) => (
        <ProfessionalSchedule
          key={profId}
          professionalId={profId}
          appointments={appointments}
        />
      ))}
    </div>
  )
}
```

---

## ✅ Validações e Regras de Negócio {#validações}

### 1. Working Days

#### Validações
```typescript
// ✅ Válido
workingDays: [1, 2, 5]           // Segunda, Terça, Sexta
workingDays: null                // Trabalha todos os dias
workingDays: []                  // Trabalha todos os dias

// ❌ Inválido
workingDays: [1, 2, 1]           // Dias duplicados
workingDays: [1, 2, 7]           // 7 fora do range (0-6)
workingDays: [-1, 0, 1]          // -1 inválido
```

#### Helpers
```typescript
const WEEK_DAYS = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
} as const

function formatWorkingDays(days: number[] | null): string {
  if (!days || days.length === 0) return 'Todos os dias'
  if (days.length === 7) return 'Todos os dias'
  
  return days
    .map(d => WEEK_DAYS[d as keyof typeof WEEK_DAYS])
    .join(', ')
}

// Uso
formatWorkingDays([1, 2, 5]) // "Segunda-feira, Terça-feira, Sexta-feira"
formatWorkingDays(null)      // "Todos os dias"
```

---

### 2. Agendamento

#### Validações
```typescript
interface ScheduleValidation {
  scheduledDate: string | null
  scheduledTime: string | null
}

function validateSchedule(data: ScheduleValidation): string | null {
  const { scheduledDate, scheduledTime } = data
  
  // Ambos null = OK (sem agendamento)
  if (!scheduledDate && !scheduledTime) return null
  
  // Ambos preenchidos = OK
  if (scheduledDate && scheduledTime) {
    // Validar formato de data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return 'Data inválida. Use formato YYYY-MM-DD'
    }
    
    // Validar formato de hora
    if (!/^\d{2}:\d{2}$/.test(scheduledTime)) {
      return 'Hora inválida. Use formato HH:MM'
    }
    
    // Validar data futura (opcional)
    const selectedDate = new Date(scheduledDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (selectedDate < today) {
      return 'Data não pode ser no passado'
    }
    
    return null
  }
  
  // Apenas um preenchido = ERRO
  if (scheduledDate && !scheduledTime) {
    return 'Hora é obrigatória quando data é fornecida'
  }
  
  if (scheduledTime && !scheduledDate) {
    return 'Data é obrigatória quando hora é fornecida'
  }
  
  return null
}
```

---

### 3. Status Transitions

#### Validação de Transição
```typescript
const STATUS_TRANSITIONS: Record<DemandStatus, DemandStatus[]> = {
  'PENDING': ['IN_PROGRESS', 'REJECTED'],
  'IN_PROGRESS': ['RESOLVED', 'REJECTED', 'PENDING'],
  'RESOLVED': ['BILLED', 'IN_PROGRESS'],
  'REJECTED': ['PENDING', 'IN_PROGRESS'],
  'BILLED': [], // Estado final
}

function canTransitionTo(
  currentStatus: DemandStatus,
  newStatus: DemandStatus
): boolean {
  return STATUS_TRANSITIONS[currentStatus].includes(newStatus)
}

function getAvailableTransitions(
  currentStatus: DemandStatus
): DemandStatus[] {
  return STATUS_TRANSITIONS[currentStatus]
}

// Uso no componente
function StatusSelector({ currentStatus, onChange }: Props) {
  const available = getAvailableTransitions(currentStatus)
  
  return (
    <select value={currentStatus} onChange={e => onChange(e.target.value)}>
      <option value={currentStatus}>{currentStatus}</option>
      {available.map(status => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  )
}
```

---

### 4. Job Titles

#### Validações
```typescript
interface JobTitleFormData {
  name: string
  description: string
  unitId: string | null
}

function validateJobTitle(data: JobTitleFormData): string | null {
  // Nome obrigatório
  if (!data.name.trim()) {
    return 'Nome do cargo é obrigatório'
  }
  
  // Tamanho do nome
  if (data.name.length < 2 || data.name.length > 100) {
    return 'Nome deve ter entre 2 e 100 caracteres'
  }
  
  // Tamanho da descrição
  if (data.description && data.description.length > 500) {
    return 'Descrição deve ter no máximo 500 caracteres'
  }
  
  return null
}
```

---

## 🚨 Tratamento de Erros {#erros}

### Códigos de Erro HTTP

| Código | Significado | Quando Ocorre |
|--------|-------------|---------------|
| 400 | Bad Request | Validação falhou, dados inválidos |
| 401 | Unauthorized | Token ausente ou inválido |
| 403 | Forbidden | Sem permissão para ação |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Unique constraint violado (ex: cargo duplicado) |
| 500 | Internal Server Error | Erro interno do servidor |

### Estrutura de Erro
```typescript
interface ApiError {
  error: string      // Mensagem de erro
  code?: string      // Código do erro (opcional)
  message?: string   // Mensagem adicional (opcional)
}
```

### Exemplos de Erros

#### 1. Job Title Duplicado (409)
```json
{
  "error": "Já existe um cargo com este nome nesta organização/unidade."
}
```

#### 2. Validação de Working Days (400)
```json
{
  "error": "body/workingDays Dias da semana não podem estar duplicados"
}
```

#### 3. Agendamento Inválido (400)
```json
{
  "error": "Hora de agendamento é obrigatória quando data é fornecida."
}
```

#### 4. Profissional Não Encontrado (400)
```json
{
  "error": "Profissional responsável não encontrado nesta unidade."
}
```

#### 5. Transição de Status Inválida (400)
```json
{
  "error": "Transição de status inválida: BILLED não pode mudar para IN_PROGRESS"
}
```

### Handler de Erros Sugerido
```typescript
async function apiRequest<T>(
  request: () => Promise<AxiosResponse<T>>
): Promise<T> {
  try {
    const response = await request()
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError
      
      // Tratar por código HTTP
      switch (error.response?.status) {
        case 400:
          toast.error(apiError.error || 'Dados inválidos')
          break
        case 401:
          // Redirecionar para login
          router.push('/login')
          break
        case 403:
          toast.error('Você não tem permissão para esta ação')
          break
        case 404:
          toast.error('Recurso não encontrado')
          break
        case 409:
          toast.error(apiError.error || 'Conflito detectado')
          break
        default:
          toast.error('Erro inesperado. Tente novamente.')
      }
    }
    
    throw error
  }
}
```

---

## 📚 Recursos Adicionais

### Documentação Completa
- **Job Titles:** `JOB_TITLES_GUIDE.md`
- **Agendamento:** `SCHEDULING_SYSTEM_GUIDE.md`
- **Cobertura de Testes:** `TEST_COVERAGE_REPORT.md`
- **API HTTP:** `api.http` (exemplos de requests)

### Postman Collection
Todos os endpoints estão documentados em `api.http` com exemplos práticos.

### Versionamento
- **API Version:** 1.0.0
- **Breaking Changes:** Esta atualização contém breaking changes
- **Migration Guide:** Este documento

---

## ✅ Checklist de Integração

### Para o Desenvolvedor Frontend:

- [ ] **Atualizar Types TypeScript**
  - [ ] Adicionar `DemandCategory` com novos valores
  - [ ] Adicionar `'BILLED'` em `DemandStatus`
  - [ ] Criar interfaces `JobTitle`, `AvailableMember`, etc.
  - [ ] Remover campos de endereço de `Demand`
  - [ ] Adicionar campos de agendamento em `Demand`
  - [ ] Adicionar `working_days` e `job_title_id` em `Member`

- [ ] **Atualizar Formulários**
  - [ ] Remover campos de endereço do formulário de demanda
  - [ ] Adicionar campos de agendamento (data, hora, responsável)
  - [ ] Adicionar seletor de working days
  - [ ] Adicionar dropdown de job titles

- [ ] **Criar Novos Componentes**
  - [ ] `WorkingDaysSelector` - Checkbox de dias da semana
  - [ ] `ScheduleDemandForm` - Formulário de agendamento
  - [ ] `AvailableProfessionalsList` - Lista de disponíveis
  - [ ] `ProfessionalSchedule` - Agenda do profissional
  - [ ] `JobTitleManager` - CRUD de cargos

- [ ] **Atualizar Componentes Existentes**
  - [ ] `DemandForm` - Remover endereço, adicionar agendamento
  - [ ] `DemandCard` - Mostrar profissional responsável
  - [ ] `DemandList` - Filtrar por status incluindo BILLED
  - [ ] `MemberCard` - Mostrar job title e working days
  - [ ] `StatusBadge` - Adicionar cor para BILLED

- [ ] **Implementar Validações**
  - [ ] Validar working_days (0-6, sem duplicatas)
  - [ ] Validar agendamento (data + hora juntos)
  - [ ] Validar transições de status
  - [ ] Validar job titles (nome obrigatório)

- [ ] **Tratamento de Erros**
  - [ ] Handler genérico de erros da API
  - [ ] Mensagens específicas por código HTTP
  - [ ] Toast/Notification para erros 409 (duplicação)

- [ ] **Testes Frontend**
  - [ ] Testar criação de job titles
  - [ ] Testar atualização de working days
  - [ ] Testar busca de disponibilidade
  - [ ] Testar criação de demanda com agendamento
  - [ ] Testar validações de formulário

---

**Última atualização:** 18/10/2025  
**Versão do documento:** 1.0  
**Autor:** Backend Team

Para dúvidas ou suporte, consulte a documentação técnica completa ou entre em contato com a equipe de backend.
