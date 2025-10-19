# 📅 API de Agenda de Disponibilidade - Guia Completo

## 🎯 Resumo

Esta API permite visualizar a disponibilidade de todos os profissionais de uma unidade em formato de agenda, facilitando a visualização de horários livres por cargo/função.

**Endpoint Principal:** `GET /organizations/:slug/units/:unitSlug/members/schedule-availability`

---

## 🚀 Como Funciona

### Frontend Ideal
1. **Lista de Cargos**: Checkbox para filtrar por job-titles específicos
2. **Agenda Visual**: 
   - **Eixo Horizontal**: Datas (ex: 20/10, 21/10, 22/10...)
   - **Eixo Vertical**: Horários com intervalos de 30 minutos (ex: 08:00, 08:30, 09:00...)
3. **Indicadores de Disponibilidade**:
   - ✅ **Verde**: Disponível
   - ❌ **Vermelho**: Conflito (já agendado)
   - ⚫ **Cinza**: Não trabalha neste dia

---

## 📖 Uso da API

### Endpoint
```http
GET /organizations/:organizationSlug/units/:unitSlug/members/schedule-availability
```

### Autenticação
✅ **Requerida** - Bearer Token

### Permissões
- Qualquer membro da organização pode consultar

### Parâmetros de URL
- `organizationSlug` - Slug da organização
- `unitSlug` - Slug da unidade

### Query Parameters
| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `startDate` | string | hoje | Data inicial (YYYY-MM-DD) |
| `days` | number | 7 | Número de dias a exibir (1-30) |
| `jobTitleIds` | string | - | IDs dos cargos separados por vírgula |
| `startHour` | number | 8 | Hora inicial do dia (0-23) |
| `endHour` | number | 18 | Hora final do dia (1-24) |

### Exemplo de Requisição

#### Buscar agenda da próxima semana
```http
GET /organizations/clinica-saude/units/unidade-1/members/schedule-availability
Authorization: Bearer eyJhbGc...
```

#### Filtrar apenas Psicólogos e Nutricionistas
```http
GET /organizations/clinica-saude/units/unidade-1/members/schedule-availability?jobTitleIds=uuid-psicologo,uuid-nutricionista&days=5
Authorization: Bearer eyJhbGc...
```

#### Agenda personalizada (horário comercial)
```http
GET /organizations/clinica-saude/units/unidade-1/members/schedule-availability?startDate=2024-10-21&days=14&startHour=9&endHour=17
Authorization: Bearer eyJhbGc...
```

---

## 📋 Estrutura da Resposta

### Resposta de Sucesso (200)
```json
{
  "schedule": {
    "dates": ["2024-10-20", "2024-10-21", "2024-10-22"],
    "timeSlots": ["08:00", "08:30", "09:00", "09:30", "10:00"],
    "jobTitles": [
      {
        "id": "uuid-psicologo",
        "name": "Psicólogo",
        "members": [
          {
            "id": "uuid-member-1",
            "userId": "uuid-user-1",
            "userName": "Dr. João Silva",
            "userEmail": "joao@email.com",
            "userAvatarUrl": "https://avatar.url",
            "workingDays": ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"],
            "availability": {
              "2024-10-20": {
                "08:00": { "available": false, "reason": "not-working-day" },
                "08:30": { "available": true, "reason": "available" },
                "09:00": { "available": false, "reason": "conflict" }
              },
              "2024-10-21": {
                "08:00": { "available": true, "reason": "available" },
                "08:30": { "available": true, "reason": "available" }
              }
            }
          }
        ]
      }
    ]
  },
  "filters": {
    "startDate": "2024-10-20",
    "days": 7,
    "jobTitleIds": ["uuid-psicologo"],
    "startHour": 8,
    "endHour": 18
  }
}
```

### Códigos de Status da Disponibilidade
- `"available"` - ✅ Profissional disponível
- `"conflict"` - ❌ Já possui agendamento 
- `"not-working-day"` - ⚫ Não trabalha neste dia da semana

---

## 🎨 Exemplo de Interface Frontend

### 1. Seletor de Cargos
```jsx
const [selectedJobTitles, setSelectedJobTitles] = useState([])

// Renderizar checkboxes para cada cargo
{schedule.jobTitles.map(jobTitle => (
  <label key={jobTitle.id}>
    <input 
      type="checkbox"
      value={jobTitle.id}
      onChange={handleJobTitleFilter}
    />
    {jobTitle.name} ({jobTitle.members.length} profissionais)
  </label>
))}
```

### 2. Grade da Agenda
```jsx
<table className="schedule-grid">
  <thead>
    <tr>
      <th>Horário</th>
      {schedule.dates.map(date => (
        <th key={date}>{formatDate(date)}</th>
      ))}
    </tr>
  </thead>
  <tbody>
    {schedule.timeSlots.map(time => (
      <tr key={time}>
        <td>{time}</td>
        {schedule.dates.map(date => (
          <td key={`${date}-${time}`}>
            {renderAvailabilityCell(date, time)}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
</table>
```

### 3. Célula de Disponibilidade
```jsx
function renderAvailabilityCell(date, time) {
  return schedule.jobTitles
    .filter(jt => selectedJobTitles.includes(jt.id))
    .flatMap(jt => jt.members)
    .map(member => {
      const slot = member.availability[date]?.[time]
      const className = slot?.available ? 'available' : 
                      slot?.reason === 'conflict' ? 'conflict' : 'not-working'
      
      return (
        <div key={member.id} className={className} title={member.userName}>
          {member.userName.split(' ')[0]}
        </div>
      )
    })
}
```

---

## 🔧 Integração com Sistema Atual

### Pré-requisitos
1. **Membros configurados** com `job_title_id`
2. **Working days definidos** para cada membro
3. **Demandas agendadas** para detectar conflitos

### Fluxo de Dados
1. **Busca membros** da unidade com job titles
2. **Filtra por cargos** (se especificado)
3. **Gera matriz** de datas × horários
4. **Calcula disponibilidade** considerando:
   - Working days do profissional
   - Agendamentos existentes (conflitos)

---

## ❌ Erros Comuns

### 404 - Unidade não encontrada
```json
{
  "error": "Unidade não encontrada."
}
```

### 400 - Data inválida
```json
{
  "error": "Data deve estar no formato YYYY-MM-DD"
}
```

### 400 - Parâmetros inválidos
```json
{
  "error": "days deve ser entre 1 e 30"
}
```

---

## 💡 Dicas de Performance

### Frontend
- **Cache a resposta** para evitar requisições desnecessárias
- **Implemente paginação** para períodos longos
- **Use debounce** em filtros para reduzir calls à API

### Backend
- API já otimizada com:
  - Single query para buscar todos os membros
  - Mapeamento eficiente de conflitos
  - Filtragem inteligente por cargo

---

## 🔄 Casos de Uso

### 1. Visualização Geral da Semana
```http
GET /organizations/clinica/units/unidade1/members/schedule-availability?days=7
```

### 2. Planejamento Mensal por Cargo
```http
GET /organizations/clinica/units/unidade1/members/schedule-availability?days=30&jobTitleIds=uuid-psicologo
```

### 3. Busca de Horário Específico
```http
GET /organizations/clinica/units/unidade1/members/schedule-availability?startDate=2024-10-25&days=1&startHour=14&endHour=16
```

---

## 📚 Documentação Relacionada
- [Sistema de Agendamento](./SCHEDULING_SYSTEM_GUIDE.md)
- [Membros e Job Titles](./MEMBER_JOB_WORKDAYS_GUIDE.md)
- [Guia de Integração Frontend](./FRONTEND_INTEGRATION_GUIDE.md)

---

## 🎯 Resumo para Desenvolvedores

**Esta API transforma a consulta de disponibilidade individual em uma visão completa tipo agenda, permitindo:**

✅ **Ver todos os profissionais** de uma vez  
✅ **Filtrar por cargo** facilmente  
✅ **Visualizar conflitos** em tempo real  
✅ **Planejar agendamentos** de forma eficiente  

**Ideal para interfaces de agendamento mais intuitivas e produtivas!** 🚀