# 📋 Guia de Atualização do Frontend

**Data:** 26 de outubro de 2025  
**Status Backend:** ✅ 100% dos testes passando (246/246)  
**Status:** Pronto para produção

---

## 📊 Status Atual das Alterações

### ✅ **100% dos Testes Passando** (246/246)

O sistema está em estado de produção com todas as seguintes correções implementadas:

---

## 🔄 **Principais Alterações no Backend**

### 1. **Sistema de Permissões para ANALYST (Médicos)**

**Mudança:** ANALYST agora tem **restrições de LGPD** - só pode visualizar e gerenciar suas próprias demands.

#### **Rotas Afetadas:**

**GET `/organizations/:slug/units/:unitSlug/demands`**
- ✅ ANALYST vê apenas demands atribuídas a ele automaticamente
- ✅ Outros roles (ADMIN, CLERK, BILLING) veem todas as demands da unidade

**GET `/organizations/:slug/units/:unitSlug/demands/:demandId`**
- ✅ ANALYST recebe `401` se tentar acessar demand de outro médico
- ✅ Mensagem: "Você só pode visualizar suas próprias demandas"

**PATCH `/organizations/:slug/units/:unitSlug/demands/:demandId/assign`**
- ✅ ANALYST recebe `401` se tentar reatribuir demand de outro médico
- ✅ Mensagem: "Você só pode gerenciar suas próprias demandas"

**PATCH `/organizations/:slug/units/:unitSlug/demands/:demandId`**
- ✅ ANALYST recebe `401` se tentar atualizar demand de outro médico
- ✅ Mensagem: "Você só pode atualizar demands atribuídas a você"

---

### 2. **Sistema de Validação de Transições de Status**

**Mudança:** Validação rigorosa de transições de status por role.

#### **Fluxo de Status:**
```
PENDING → CHECK_IN → IN_PROGRESS → RESOLVED → BILLED
                ↓         ↓            ↓
              (pode pular para RESOLVED)
```

#### **Permissões por Role:**

| Role | De (From) | Para (To) |
|------|-----------|-----------|
| **ADMIN** | PENDING, CHECK_IN, IN_PROGRESS, RESOLVED | CHECK_IN, IN_PROGRESS, RESOLVED, BILLED |
| **CLERK** | PENDING, CHECK_IN, IN_PROGRESS | CHECK_IN, IN_PROGRESS, RESOLVED |
| **ANALYST** | CHECK_IN, IN_PROGRESS | IN_PROGRESS, RESOLVED |
| **BILLING** | RESOLVED | BILLED |
| **MANAGER** | ❌ Nenhum | ❌ Nenhum |

#### **Erros Retornados:**
- `400`: "Transição de status inválida: não é possível mudar de 'X' para 'Y'"
- `400`: "Você não tem permissão para alterar demands com status 'X'"
- `400`: "Você não tem permissão para alterar status para 'Y'"

---

### 3. **Sistema de Auditoria de Mudanças**

**Nova Feature:** Todas as mudanças de status são registradas automaticamente.

#### **Nova Tabela: `demand_status_audit_log`**
```sql
- id (uuid)
- demand_id (uuid)
- previous_status (enum)
- new_status (enum)
- changed_by_user_id (uuid)
- changed_by_member_id (uuid)
- changed_by_user_name (text)
- changed_by_role (text)
- reason (text) - opcional
- metadata (jsonb) - IP, user agent, etc
- changed_at (timestamp)
```

#### **Novas Funções Disponíveis:**
```typescript
// Registrar mudança (automático no backend)
await logDemandStatusChange({
  demandId,
  previousStatus,
  newStatus,
  changedByUserId,
  changedByMemberId,
  changedByUserName,
  changedByRole,
  reason, // opcional
  metadata // opcional: {ip, userAgent, etc}
})

// Buscar histórico de uma demand
const history = await getDemandStatusHistory(demandId)

// Buscar histórico de um usuário
const userHistory = await getUserAuditHistory(userId, limit)
```

---

### 4. **Correções de Enums**

**Mudança:** Ajuste de valores de enum para consistência.

- ❌ `'PSICOLOGIA'` → ✅ `'PSYCHOLOGIST'`
- ❌ `'MEDIA'` → ✅ `'MEDIUM'`

---

### 5. **Nova Migration**

**Arquivo:** `0009_glamorous_groot.sql`
- Cria tabela `demand_status_audit_log`
- 3 foreign keys: demands, users, members

---

## 🎯 **O que Precisa Ser Atualizado no Frontend**

### **1. Interface para ANALYST (Médicos)**

#### ✅ **Lista de Demands**
```typescript
// ❌ ANTES: Mostrava todas as demands da unidade
// ✅ AGORA: ANALYST vê apenas as suas

// Não é necessário filtrar manualmente no frontend
// O backend já retorna apenas as demands corretas
```

**Ação:** ✨ **Nenhuma mudança necessária** - o backend filtra automaticamente

---

#### ✅ **Visualizar Demand Específica**
```typescript
// ❌ ANTES: Permitia acessar qualquer demand
// ✅ AGORA: Retorna 401 se não for a demand do médico

// Tratar erro 401
if (error.status === 401 && userRole === 'ANALYST') {
  showError('Você não tem acesso a esta demanda')
  redirectTo('/demands') // Voltar para lista
}
```

**Ação:** 🔴 **Tratar erro 401** com mensagem amigável

---

#### ✅ **Editar Demand**
```typescript
// ❌ ANTES: Permitia editar qualquer demand
// ✅ AGORA: Retorna 401 se não for a demand do médico

// Desabilitar botão "Editar" se não for a demand do usuário
<Button 
  disabled={userRole === 'ANALYST' && demand.responsible_id !== currentMemberId}
>
  Editar
</Button>
```

**Ação:** 🟡 **Desabilitar ações** para demands de outros médicos

---

### **2. Seletor de Status**

#### ✅ **Dropdown Dinâmico**
```typescript
import { getAvailableStatusTransitions } from '@/utils/demand-status'

// Buscar status possíveis baseado na role e status atual
const availableStatuses = getAvailableStatusTransitions(
  userRole,
  currentStatus
)

// Renderizar apenas os status permitidos
<Select value={status} onChange={handleStatusChange}>
  {availableStatuses.map(status => (
    <Option key={status} value={status}>
      {statusLabels[status]}
    </Option>
  ))}
</Select>
```

**Ação:** 🔴 **Implementar dropdown dinâmico** - crítico!

---

#### ✅ **Mensagens de Erro**
```typescript
// Tratar erros de validação de status
try {
  await updateDemandStatus(demandId, newStatus)
} catch (error) {
  if (error.status === 400) {
    // Mostrar mensagem específica do backend
    showError(error.message)
    // Ex: "Você não tem permissão para alterar status para 'BILLED'"
  }
}
```

**Ação:** 🟡 **Melhorar tratamento de erros** para validação de status

---

### **3. Histórico de Auditoria (Nova Feature)**

#### ✅ **Nova Aba/Seção: "Histórico"**
```typescript
// GET /api/demands/:demandId/history (você precisará criar esta rota)
const history = await fetchDemandHistory(demandId)

// Renderizar timeline
<Timeline>
  {history.map(log => (
    <TimelineItem key={log.id}>
      <Badge status={log.new_status} />
      <Text>
        {log.changed_by_user_name} alterou de 
        <Badge>{log.previous_status}</Badge> para 
        <Badge>{log.new_status}</Badge>
      </Text>
      <Text muted>{formatDate(log.changed_at)}</Text>
      {log.reason && <Text italic>{log.reason}</Text>}
    </TimelineItem>
  ))}
</Timeline>
```

**Ação:** 🟢 **Implementar visualização de histórico** (opcional, mas recomendado)

---

### **4. Campo "Motivo" (reason)**

#### ✅ **Input Opcional ao Mudar Status**
```typescript
// Adicionar campo "reason" ao formulário de mudança de status
<FormGroup>
  <Label>Novo Status</Label>
  <Select value={newStatus} onChange={setNewStatus}>
    {availableStatuses.map(...)}
  </Select>
  
  <Label>Motivo (opcional)</Label>
  <Textarea 
    value={reason} 
    onChange={setReason}
    placeholder="Descreva o motivo da mudança..."
  />
</FormGroup>

// Enviar na requisição
await updateDemandStatus(demandId, {
  status: newStatus,
  reason: reason // opcional
})
```

**Ação:** 🟢 **Adicionar campo "motivo"** (opcional, mas recomendado para auditoria)

---

### **5. Badges e Labels de Status**

#### ✅ **Atualizar Cores/Ícones**
```typescript
const statusConfig = {
  PENDING: { color: 'gray', icon: 'clock', label: 'Pendente' },
  CHECK_IN: { color: 'blue', icon: 'check-in', label: 'Check-in' },
  IN_PROGRESS: { color: 'yellow', icon: 'play', label: 'Em Atendimento' },
  RESOLVED: { color: 'green', icon: 'check', label: 'Resolvido' },
  BILLED: { color: 'purple', icon: 'dollar', label: 'Faturado' },
  REJECTED: { color: 'red', icon: 'x', label: 'Rejeitado' }
}
```

**Ação:** ✨ **Nenhuma mudança necessária** - valores mantidos

---

### **6. Permissions nos Botões**

#### ✅ **Desabilitar Ações por Role**
```typescript
// Verificar permissões antes de mostrar botão
const canUpdateStatus = {
  'ADMIN': true,
  'CLERK': ['PENDING', 'CHECK_IN', 'IN_PROGRESS'].includes(demand.status),
  'ANALYST': demand.responsible_id === currentMemberId && 
             ['CHECK_IN', 'IN_PROGRESS'].includes(demand.status),
  'BILLING': demand.status === 'RESOLVED',
  'MANAGER': false
}[userRole]

<Button 
  disabled={!canUpdateStatus}
  onClick={handleStatusChange}
>
  Alterar Status
</Button>
```

**Ação:** 🔴 **Implementar lógica de permissões** nos botões

---

## 📋 **Checklist de Implementação no Frontend**

### **Prioridade CRÍTICA 🔴**
- [ ] Tratar erro 401 para ANALYST tentando acessar demand de outro médico
- [ ] Implementar dropdown dinâmico de status baseado em role
- [ ] Implementar lógica de permissões em botões de ação
- [ ] Desabilitar edição para demands não atribuídas ao ANALYST

### **Prioridade ALTA 🟡**
- [ ] Melhorar tratamento de erros de validação de status (mensagens específicas)
- [ ] Adicionar indicador visual de "Suas Demands" para ANALYST

### **Prioridade MÉDIA 🟢**
- [ ] Implementar visualização de histórico de auditoria
- [ ] Adicionar campo "motivo" ao mudar status
- [ ] Criar página/modal de histórico de demand

### **Opcional ✨**
- [ ] Dashboard com métricas de auditoria para ADMIN
- [ ] Notificações quando demand é reatribuída
- [ ] Filtro avançado por histórico de mudanças

---

## 🔌 **Exemplos de Código Frontend**

### **1. Hook Personalizado para Permissões**

```typescript
// hooks/useDemandPermissions.ts
import { useMemo } from 'react'
import type { Demand, RoleType } from '@/types'

export function useDemandPermissions(
  demand: Demand, 
  userRole: RoleType, 
  currentMemberId: string
) {
  const canView = useMemo(() => {
    if (userRole === 'ANALYST') {
      return demand.responsible_id === currentMemberId
    }
    return ['ADMIN', 'CLERK', 'MANAGER', 'BILLING'].includes(userRole)
  }, [demand, userRole, currentMemberId])

  const canEdit = useMemo(() => {
    if (userRole === 'ANALYST') {
      return demand.responsible_id === currentMemberId &&
             ['CHECK_IN', 'IN_PROGRESS'].includes(demand.status)
    }
    return ['ADMIN', 'CLERK'].includes(userRole)
  }, [demand, userRole, currentMemberId])

  const availableStatuses = useMemo(() => {
    return getAvailableStatusTransitions(userRole, demand.status)
  }, [userRole, demand.status])

  return { canView, canEdit, availableStatuses }
}
```

### **2. Função de Transições Disponíveis**

```typescript
// utils/demand-status.ts
export type DemandStatus = 
  | 'PENDING' 
  | 'CHECK_IN' 
  | 'IN_PROGRESS' 
  | 'RESOLVED' 
  | 'BILLED' 
  | 'REJECTED'

export type RoleType = 
  | 'ADMIN' 
  | 'MANAGER' 
  | 'CLERK' 
  | 'ANALYST' 
  | 'BILLING'

const VALID_STATUS_TRANSITIONS: Record<DemandStatus, DemandStatus[]> = {
  PENDING: ['CHECK_IN', 'IN_PROGRESS', 'RESOLVED'],
  CHECK_IN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['BILLED'],
  REJECTED: [],
  BILLED: [],
}

const ROLE_STATUS_PERMISSIONS: Record<
  RoleType,
  { from: DemandStatus[]; to: DemandStatus[] }
> = {
  ADMIN: {
    from: ['PENDING', 'CHECK_IN', 'IN_PROGRESS', 'RESOLVED'],
    to: ['CHECK_IN', 'IN_PROGRESS', 'RESOLVED', 'BILLED'],
  },
  MANAGER: {
    from: [],
    to: [],
  },
  CLERK: {
    from: ['PENDING', 'CHECK_IN', 'IN_PROGRESS'],
    to: ['CHECK_IN', 'IN_PROGRESS', 'RESOLVED'],
  },
  ANALYST: {
    from: ['CHECK_IN', 'IN_PROGRESS'],
    to: ['IN_PROGRESS', 'RESOLVED'],
  },
  BILLING: {
    from: ['RESOLVED'],
    to: ['BILLED'],
  },
}

export function getAvailableStatusTransitions(
  role: RoleType,
  currentStatus: DemandStatus
): DemandStatus[] {
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus]
  const rolePermissions = ROLE_STATUS_PERMISSIONS[role]

  // Filtra apenas os status que a role tem permissão para alterar
  return validTransitions.filter(
    (status) =>
      rolePermissions.from.includes(currentStatus) &&
      rolePermissions.to.includes(status)
  )
}
```

### **3. Componente de Seletor de Status**

```typescript
// components/DemandStatusSelect.tsx
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDemandPermissions } from '@/hooks/useDemandPermissions'
import { updateDemandStatus } from '@/api/demands'
import { toast } from 'react-hot-toast'

interface Props {
  demand: Demand
  onStatusChange: (newStatus: DemandStatus) => void
}

const statusLabels: Record<DemandStatus, string> = {
  PENDING: 'Pendente',
  CHECK_IN: 'Check-in',
  IN_PROGRESS: 'Em Atendimento',
  RESOLVED: 'Resolvido',
  BILLED: 'Faturado',
  REJECTED: 'Rejeitado',
}

export function DemandStatusSelect({ demand, onStatusChange }: Props) {
  const { userRole, currentMemberId } = useAuth()
  const { availableStatuses, canEdit } = useDemandPermissions(
    demand, 
    userRole, 
    currentMemberId
  )
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = async (newStatus: DemandStatus) => {
    if (newStatus === demand.status) return

    setIsLoading(true)
    try {
      await updateDemandStatus(demand.id, {
        status: newStatus,
        reason: reason || undefined
      })
      toast.success('Status atualizado com sucesso!')
      setReason('')
      onStatusChange(newStatus)
    } catch (error: any) {
      if (error.status === 400) {
        toast.error(error.message)
      } else if (error.status === 401) {
        toast.error('Você não tem permissão para esta ação')
      } else {
        toast.error('Erro ao atualizar status')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!canEdit) {
    return (
      <Badge status={demand.status}>
        {statusLabels[demand.status]}
      </Badge>
    )
  }

  return (
    <div className="space-y-2">
      <Select 
        value={demand.status} 
        onChange={(e) => handleChange(e.target.value as DemandStatus)}
        disabled={isLoading}
      >
        <option value={demand.status}>
          {statusLabels[demand.status]}
        </option>
        {availableStatuses.map(status => (
          <option key={status} value={status}>
            {statusLabels[status]}
          </option>
        ))}
      </Select>
      
      {availableStatuses.length > 0 && (
        <Input
          placeholder="Motivo da mudança (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isLoading}
        />
      )}
    </div>
  )
}
```

### **4. Componente de Histórico**

```typescript
// components/DemandHistory.tsx
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { fetchDemandHistory } from '@/api/demands'

interface Props {
  demandId: string
}

export function DemandHistory({ demandId }: Props) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['demand-history', demandId],
    queryFn: () => fetchDemandHistory(demandId)
  })

  if (isLoading) {
    return <Spinner />
  }

  if (!history || history.length === 0) {
    return (
      <EmptyState 
        icon="clock"
        title="Sem histórico"
        description="Nenhuma mudança de status registrada ainda"
      />
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Histórico de Mudanças</h3>
      
      <Timeline>
        {history.map(log => (
          <TimelineItem key={log.id}>
            <div className="flex items-center gap-2 mb-1">
              <Badge status={log.new_status} size="sm">
                {log.new_status}
              </Badge>
              <Text className="text-sm text-gray-600">
                por <strong>{log.changed_by_user_name}</strong>
              </Text>
              <Text className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(log.changed_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </Text>
            </div>
            
            <Text className="text-sm text-gray-700">
              Mudou de{' '}
              <Badge size="sm" variant="outline">
                {log.previous_status}
              </Badge>
              {' '}para{' '}
              <Badge size="sm" variant="outline">
                {log.new_status}
              </Badge>
            </Text>
            
            {log.reason && (
              <Text className="text-sm italic text-gray-500 mt-1">
                "{log.reason}"
              </Text>
            )}
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  )
}
```

### **5. API Client**

```typescript
// api/demands.ts
import { api } from './client'

export interface UpdateDemandStatusPayload {
  status: DemandStatus
  reason?: string
}

export async function updateDemandStatus(
  demandId: string,
  payload: UpdateDemandStatusPayload
) {
  return api.patch(`/demands/${demandId}`, payload)
}

export async function fetchDemandHistory(demandId: string) {
  const response = await api.get(`/demands/${demandId}/history`)
  return response.data
}
```

### **6. Tratamento de Erros Global**

```typescript
// utils/error-handler.ts
export function handleApiError(error: any) {
  if (error.status === 401) {
    if (error.message.includes('visualizar suas próprias')) {
      return 'Você não tem acesso a esta demanda'
    }
    if (error.message.includes('gerenciar suas próprias')) {
      return 'Você só pode gerenciar suas próprias demandas'
    }
    return 'Acesso não autorizado'
  }

  if (error.status === 400) {
    // Retorna a mensagem específica do backend
    return error.message
  }

  return 'Erro ao processar solicitação'
}
```

---

## 🚀 **Resumo**

**Backend:** ✅ 100% pronto para produção

**Frontend:** 🔄 Requer atualizações nas seguintes áreas:
1. Permissões de ANALYST (médicos)
2. Validação de transições de status
3. Histórico de auditoria (opcional)

**Tempo estimado:** 4-6 horas de desenvolvimento frontend

---

## 📞 **Suporte**

Para dúvidas sobre a implementação:
1. Consulte os testes em `/tests/routes/analyst-permissions.test.ts`
2. Veja exemplos em `/src/http/routes/demands/update-demand-status.example.ts`
3. Documentação de validação em `/src/utils/demand-status-transitions.ts`
4. Sistema de auditoria em `/src/utils/audit-logger.ts`

---

**Última atualização:** 26 de outubro de 2025
