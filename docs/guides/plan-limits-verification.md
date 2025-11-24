# Sistema de Verificação de Limites de Planos

## 🎯 Como Funciona

O sistema verifica os limites de recursos (members, units, demands) em **tempo real**, contando diretamente do banco de dados. **Não depende** de registros pré-calculados na tabela `usageRecords`.

## 📊 Duas Abordagens

### 1. Verificação em Tempo Real (Usado nos Middlewares)

**Quando usar:** Sempre que precisar bloquear criação de recursos

**Como funciona:**
```typescript
// Conta direto do banco de dados
const membersCount = await db
  .select({ count: sql`count(*)` })
  .from(members)
  .where(eq(members.organization_id, organizationId))

// Compara com limite do plano
if (membersCount >= plan.max_members) {
  // BLOQUEIA
}
```

**Vantagens:**
- ✅ Sempre preciso
- ✅ Não depende de processos externos
- ✅ Impossível burlar

**Desvantagens:**
- ⚠️ Faz queries extras no banco

### 2. Registros de Uso (Opcional - Para Dashboard)

**Quando usar:** Para mostrar estatísticas históricas ou dashboards

**Como funciona:**
- Cronjob roda 1x por hora
- Conta todos os recursos
- Salva snapshot na tabela `usageRecords`

**Vantagens:**
- ✅ Rápido para consultar
- ✅ Permite histórico
- ✅ Bom para dashboards

**Desvantagens:**
- ⚠️ Pode estar desatualizado
- ⚠️ Precisa de cronjob

## 🔒 Verificação de Limites por Tipo

### Members (Membros)

**Limite:** `plan.max_members`

**Como conta:**
```sql
SELECT count(*) FROM members 
WHERE organization_id = ?
```

**Quando verifica:**
- Antes de criar novo membro
- Middleware: `checkResourceLimit('member')`

**Exemplo de erro:**
```json
{
  "code": "RESOURCE_LIMIT_EXCEEDED",
  "resource_type": "member",
  "current_count": 20,
  "limit": 20,
  "message": "Limite de members atingido (20/20)"
}
```

### Units (Unidades)

**Limite:** `plan.max_units`

**Como conta:**
```sql
SELECT count(*) FROM units 
WHERE organization_id = ?
```

**Quando verifica:**
- Antes de criar nova unidade
- Middleware: `checkResourceLimit('unit')`

### Demands (Demandas)

**Limite:** `plan.max_demands` (por mês)

**Como conta:**
```sql
SELECT count(*) 
FROM demands d
INNER JOIN units u ON d.unit_id = u.id
WHERE u.organization_id = ?
  AND d.created_at >= [início do mês]
```

**Detalhe importante:** Conta apenas demandas do **mês atual**, não total.

**Quando verifica:**
- Antes de criar nova demanda
- Middleware: `checkResourceLimit('demand')`

### Storage (Armazenamento)

**Limite:** `plan.max_storage_gb`

**Como conta:**
```sql
SELECT SUM(size) FROM attachments
WHERE organization_id = ?
```

**Quando verifica:**
- Antes de fazer upload
- Middleware: `checkStorageLimit`

## 🛠️ Implementação

### No Backend - Middleware

```typescript
// src/http/routes/members.ts

app.post('/organizations/:organizationId/members', {
  preHandler: [
    authPreHandler,                    // 1. Verifica autenticação
    requireActiveSubscription,         // 2. Verifica se tem assinatura
    checkResourceLimit('member'),      // 3. Verifica limite de membros
  ],
}, async (request, reply) => {
  // ✅ Se chegou aqui, pode criar
  const member = await createMember(...)
  return reply.send(member)
})
```

### Ordem de Verificação

```
1. authPreHandler
   ↓ Usuário autenticado?
   ↓ NÃO → 401 Unauthorized
   ↓ SIM
   
2. requireActiveSubscription
   ↓ Tem assinatura ativa?
   ↓ NÃO → 403 NO_ACTIVE_SUBSCRIPTION
   ↓ SIM
   ↓ Assinatura expirou?
   ↓ SIM → 403 SUBSCRIPTION_EXPIRED
   ↓ NÃO
   
3. checkResourceLimit('member')
   ↓ Conta membros no banco
   ↓ Compara com plan.max_members
   ↓ Atingiu limite?
   ↓ SIM → 403 RESOURCE_LIMIT_EXCEEDED
   ↓ NÃO
   
4. ✅ Pode criar o membro
```

## 📡 API Endpoints

### Verificar Uso Atual

```bash
GET /organizations/:organizationId/usage
```

**Resposta:**
```json
{
  "plan_name": "Plano Básico",
  "members": {
    "current": 15,
    "limit": 20,
    "percentage": 75
  },
  "units": {
    "current": 2,
    "limit": 3,
    "percentage": 67
  },
  "demands": {
    "current": 45,
    "limit": 100,
    "percentage": 45
  },
  "storage": {
    "current": 3.5,
    "limit": 10,
    "percentage": 35
  }
}
```

### Verificar se Pode Criar

```bash
GET /organizations/:organizationId/can-create/member
GET /organizations/:organizationId/can-create/unit
GET /organizations/:organizationId/can-create/demand
```

**Resposta (Permitido):**
```json
{
  "allowed": true,
  "current": 15,
  "limit": 20
}
```

**Resposta (Bloqueado):**
```json
{
  "allowed": false,
  "reason": "Limite de members atingido (20/20)",
  "current": 20,
  "limit": 20
}
```

## 🎨 Frontend

### Componente de Uso

```tsx
// components/UsageWidget.tsx
'use client'

import { useEffect, useState } from 'react'

export default function UsageWidget({ organizationId }) {
  const [usage, setUsage] = useState(null)
  
  useEffect(() => {
    fetch(`/api/organizations/${organizationId}/usage`)
      .then(res => res.json())
      .then(setUsage)
  }, [organizationId])
  
  if (!usage) return null
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-bold mb-4">Uso do Plano: {usage.plan_name}</h3>
      
      {/* Membros */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Membros</span>
          <span>{usage.members.current} / {usage.members.limit || '∞'}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              usage.members.percentage >= 90 ? 'bg-red-500' :
              usage.members.percentage >= 70 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${usage.members.percentage}%` }}
          />
        </div>
      </div>
      
      {/* Unidades */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Unidades</span>
          <span>{usage.units.current} / {usage.units.limit || '∞'}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              usage.units.percentage >= 90 ? 'bg-red-500' :
              usage.units.percentage >= 70 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${usage.units.percentage}%` }}
          />
        </div>
      </div>
      
      {/* Aviso se próximo do limite */}
      {(usage.members.percentage >= 80 || 
        usage.units.percentage >= 80 || 
        usage.demands.percentage >= 80) && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            ⚠️ Você está próximo do limite do plano.
            <a href="/plans" className="ml-1 underline font-semibold">
              Fazer upgrade
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
```

### Verificar Antes de Criar

```tsx
// Antes de mostrar formulário de criar membro
async function checkCanCreateMember() {
  const res = await fetch(`/api/organizations/${orgId}/can-create/member`)
  const result = await res.json()
  
  if (!result.allowed) {
    // Mostra modal de upgrade
    showUpgradeModal({
      message: result.reason,
      current: result.current,
      limit: result.limit,
    })
    return false
  }
  
  return true
}

// No botão
<button onClick={async () => {
  const canCreate = await checkCanCreateMember()
  if (canCreate) {
    showCreateMemberForm()
  }
}}>
  Adicionar Membro
</button>
```

## 🔄 Cronjob (Opcional)

Para manter registros históricos na tabela `usageRecords`:

### Configurar Cronjob

```bash
# Editar crontab
crontab -e

# Adicionar linha (roda 1x por hora)
0 * * * * cd /path/to/server-equipe-ativa && node --experimental-strip-types scripts/update-usage-records.ts >> /var/log/usage-tracking.log 2>&1
```

### Verificar Logs

```bash
tail -f /var/log/usage-tracking.log
```

**Saída esperada:**
```
🚀 Iniciando atualização de registros de uso...
📅 2024-11-24T15:00:00.000Z
📊 Atualizando uso de 5 assinaturas...
✅ Assinatura 123e4567-e89b-12d3-a456-426614174000 atualizada
✅ Assinatura 223e4567-e89b-12d3-a456-426614174001 atualizada
...
✅ Atualização concluída com sucesso!
```

## ⚡ Performance

### Queries Executadas

Para cada verificação:
```sql
-- 1 query por tipo de recurso
SELECT count(*) FROM members WHERE organization_id = ?
SELECT count(*) FROM units WHERE organization_id = ?
SELECT count(*) FROM demands d
  JOIN units u ON d.unit_id = u.id
  WHERE u.organization_id = ? 
    AND d.created_at >= ?
```

### Otimização

Se necessário, adicione índices:
```sql
CREATE INDEX idx_members_organization ON members(organization_id);
CREATE INDEX idx_units_organization ON units(organization_id);
CREATE INDEX idx_demands_created_at ON demands(created_at);
```

## 🧪 Testes

### Testar Limite de Membros

```bash
# 1. Crie organização com plano Básico (limit: 20 membros)
POST /organizations

# 2. Crie 20 membros
for i in {1..20}; do
  POST /organizations/:id/members
done

# 3. Tente criar 21º membro (deve falhar)
POST /organizations/:id/members
# Esperado: 403 RESOURCE_LIMIT_EXCEEDED
```

### Testar Sem Assinatura

```bash
# 1. Cancele assinatura da organização
POST /subscriptions/:id/cancel

# 2. Tente criar membro
POST /organizations/:id/members
# Esperado: 403 NO_ACTIVE_SUBSCRIPTION
```

## 📊 Tabela de Limites Padrão

| Plano | Membros | Unidades | Demandas/mês | Storage |
|-------|---------|----------|--------------|---------|
| Gratuito | 5 | 1 | 10 | 1 GB |
| Básico | 20 | 3 | 100 | 10 GB |
| Profissional | 100 | 10 | 1000 | 100 GB |
| Enterprise | ∞ | ∞ | ∞ | 1 TB |

`null` = ilimitado

## ✅ Checklist

- [x] Serviço `usageTrackingService` criado
- [x] Verificação em tempo real implementada
- [x] Middleware `checkResourceLimit` atualizado
- [x] Rotas de uso criadas (`/organizations/:id/usage`)
- [x] Script de cronjob criado
- [x] Documentação completa
- [ ] Aplicar middleware em todas as rotas de criação
- [ ] Criar componente frontend de uso
- [ ] Configurar cronjob em produção (opcional)
- [ ] Adicionar índices no banco para performance
- [ ] Testar todos os limites

## 🚀 Próximos Passos

1. **Aplicar middlewares nas rotas:**
   - `POST /organizations/:id/members` → `checkResourceLimit('member')`
   - `POST /organizations/:id/units` → `checkResourceLimit('unit')`
   - `POST /organizations/:id/demands` → `checkResourceLimit('demand')`

2. **Criar componente de uso no frontend**
   - Widget no dashboard
   - Modal de upgrade quando atingir limite
   - Indicador visual de proximidade do limite

3. **Configurar cronjob (opcional)**
   - Apenas se quiser histórico de uso
   - Não é necessário para funcionamento básico
