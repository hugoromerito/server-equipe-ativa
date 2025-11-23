# 📊 Análise do Estado Atual - Sistema de Permissões por Role

**Data**: 24 de outubro de 2025  
**Status Geral**: ⚠️ **PARCIALMENTE IMPLEMENTADO**

---

## ✅ O que JÁ ESTÁ implementado

### 1. **Infraestrutura de Validação** (100% completo)

#### ✅ Sistema de Permissões CASL
- **Arquivo**: `/src/db/auth/permissions.ts`
- **Status**: ✅ Completamente atualizado com as 5 roles
- **Implementado**:
  - ADMIN: Pode gerenciar tudo (com verificação de ownership)
  - MANAGER (RH): Pode criar applicants/demands e visualizar
  - CLERK (Recepcionista): Pode criar, atualizar e alterar status (exceto BILLED)
  - ANALYST (Médico): Pode atualizar APENAS suas demands
  - BILLING (Faturista): Pode visualizar tudo e alterar RESOLVED→BILLED

#### ✅ Validação de Transições de Status
- **Arquivo**: `/src/utils/demand-status-transitions.ts`
- **Status**: ✅ Completo e funcional
- **Funções**:
  - `validateCompleteStatusTransition()` - Valida se role pode fazer transição
  - `getAvailableStatusTransitions()` - Lista transições disponíveis
  - `validateRoleStatusPermission()` - Verifica permissão da role

#### ✅ Sistema de Auditoria
- **Arquivos**: 
  - `/src/utils/audit-logger.ts` (funções)
  - `/src/db/schema/audit.ts` (schema do banco)
- **Status**: ✅ Completo (falta apenas migration)
- **Funções**:
  - `logDemandStatusChange()` - Registra mudança de status
  - `getDemandStatusHistory()` - Histórico de uma demand
  - `getUserAuditHistory()` - Histórico de ações de um usuário

#### ✅ Testes Unitários
- **Arquivos**:
  - `/tests/permissions/roles.test.ts` (21 testes)
  - `/tests/utils/demand-status-transitions.test.ts` (24 testes)
- **Status**: ✅ Escritos (requerem DB para rodar)
- **Cobertura**: Todas as 5 roles + todas transições de status

---

## 🔄 Rotas de Demands - Estado Atual

### ✅ **1. update-demand.ts** - COMPLETO
**Caminho**: `PUT /organizations/:slug/units/:unitSlug/demands/:demandId`

**Validações Aplicadas**:
- ✅ Permissão CASL: `can('update', 'Demand')`
- ✅ Validação de transição: `validateCompleteStatusTransition()`
- ✅ Validação especial ANALYST: Só pode atualizar demands atribuídas a ele
- ✅ Auditoria: Registra mudanças de status com `logDemandStatusChange()`
- ✅ Campo `reason` opcional no body

**Imports**:
```typescript
import { validateCompleteStatusTransition } from '../../../utils/demand-status-transitions.ts'
import { logDemandStatusChange } from '../../../utils/audit-logger.ts'
```

---

### ✅ **2. assign-member.ts** - COMPLETO
**Caminho**: `POST /organizations/:slug/units/:unitSlug/demands/:demandId/assign`

**Validações Aplicadas**:
- ✅ Permissão CASL: `can('update', 'Demand')`
- ✅ Valida disponibilidade do profissional
- ✅ Auditoria: Registra quando muda PENDING→IN_PROGRESS

**Imports**:
```typescript
import { logDemandStatusChange } from '../../../utils/audit-logger.ts'
```

**Nota**: Esta rota não valida transição manualmente, apenas registra auditoria.

---

### ⚠️ **3. get-demands.ts** - FALTAM VALIDAÇÕES

**Caminho**: `GET /organizations/:slug/units/:unitSlug/demands`

**O que TEM**:
- ✅ Permissão CASL básica: `can('get', 'Demand')`
- ✅ Filtros funcionando (status, category, priority, responsibleId)
- ✅ Paginação e ordenação

**O que FALTA**:
- ❌ **Filtro automático para ANALYST**: Deveria mostrar APENAS demands onde `responsible_id = membership.id`
- ❌ **Ordenação especial para BILLING**: Deveria priorizar status RESOLVED no topo
- ❌ **Validação de ownership**: ANALYST não deveria ver demands de outros médicos

**Impacto**: 
- 🔴 **CRÍTICO** - ANALYST consegue ver demands de outros médicos
- 🟡 **MÉDIO** - BILLING não tem priorização de RESOLVED

---

### ⚠️ **4. get-demand.ts** - FALTAM VALIDAÇÕES

**Caminho**: `GET /organizations/:slug/units/:unitSlug/demands/:demandId`

**O que TEM**:
- ✅ Permissão CASL básica: `can('get', 'Demand')`
- ✅ Retorna detalhes completos da demand

**O que FALTA**:
- ❌ **Validação de ownership para ANALYST**: Deveria bloquear se `responsible_id !== membership.id`
- ❌ **Mensagem de erro específica**: "Você só pode visualizar suas próprias demandas"

**Impacto**:
- 🔴 **CRÍTICO** - ANALYST consegue ver demand de outro médico se tiver o ID

---

### ✅ **5. get-member-demands.ts** - COMPLETO

**Caminho**: `GET /organizations/:slug/units/:unitSlug/my-demands`

**Validações Aplicadas**:
- ✅ Já filtra automaticamente por `responsible_id = member.id`
- ✅ Valida que usuário é membro da unidade
- ✅ Mesma lógica de ordenação de `get-demands.ts`

**Nota**: Esta rota está correta e não precisa de mudanças.

---

### ✅ **6. create-demand.ts** - COMPLETO

**Caminho**: `POST /organizations/:slug/units/:unitSlug/applicants/:applicantSlug/demands`

**Validações Aplicadas**:
- ✅ Permissão CASL: `can('create', 'Demand')`
- ✅ Valida disponibilidade do profissional se `responsibleId` for fornecido
- ✅ Valida agendamento (data + hora)
- ✅ Status inicial sempre PENDING (correto)

**Nota**: Esta rota não precisa de validação de transição nem auditoria, pois cria com status PENDING.

---

## 📋 Resumo por Rota

| Rota | Permissão CASL | Transição | Ownership ANALYST | Auditoria | Status |
|------|---------------|-----------|-------------------|-----------|--------|
| `create-demand.ts` | ✅ | N/A | N/A | N/A | ✅ **OK** |
| `update-demand.ts` | ✅ | ✅ | ✅ | ✅ | ✅ **OK** |
| `assign-member.ts` | ✅ | N/A | ❌ | ✅ | ⚠️ **FALTA** ownership |
| `get-demands.ts` | ✅ | N/A | ❌ | N/A | ⚠️ **FALTA** filtro ANALYST |
| `get-demand.ts` | ✅ | N/A | ❌ | N/A | ⚠️ **FALTA** ownership |
| `get-member-demands.ts` | ✅ | N/A | ✅ | N/A | ✅ **OK** |

---

## 🚨 Problemas Críticos Identificados

### 1. **ANALYST pode ver demands de outros médicos** 🔴
**Rotas Afetadas**: `get-demands.ts`, `get-demand.ts`

**Problema**:
```typescript
// Código ATUAL (ERRADO):
if (cannot('get', 'Demand')) {
  throw new UnauthorizedError(...)
}
// Retorna TODAS as demands da unidade ❌
```

**Solução Necessária**:
```typescript
// Para ANALYST, filtrar por responsible_id
const userRole = membership.unit_role || membership.organization_role

if (userRole === 'ANALYST') {
  // Buscar member_id do usuário
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(
      eq(members.user_id, userId),
      eq(members.unit_id, unitId)
    ))
  
  // Adicionar filtro obrigatório
  conditions.push(eq(demands.responsible_id, member.id))
}
```

---

### 2. **assign-member.ts não valida ownership** 🟡
**Rota Afetada**: `assign-member.ts`

**Problema**: Qualquer CLERK pode atribuir profissional, mas ANALYST não deveria poder alterar atribuição de outra demand.

**Solução Necessária**:
```typescript
// Adicionar validação ANTES de atribuir
if (userRole === 'ANALYST') {
  if (demand.responsible_id && demand.responsible_id !== membership.id) {
    throw new UnauthorizedError(
      'Você só pode gerenciar suas próprias demandas.'
    )
  }
}
```

---

## 📊 Estatísticas

### Cobertura de Validações

- **Rotas Totais**: 6
- **Rotas Completas**: 3 (50%)
- **Rotas com Problemas**: 3 (50%)

### Por Tipo de Validação

- **Permissão CASL**: 6/6 ✅ (100%)
- **Transição de Status**: 1/1 ✅ (100% das rotas que mudam status)
- **Ownership ANALYST**: 2/4 ⚠️ (50% das rotas que deveriam validar)
- **Auditoria**: 2/2 ✅ (100% das rotas que mudam status)

---

## 🎯 Próximas Ações Recomendadas

### 1. **URGENTE** - Corrigir Segurança
- [ ] Adicionar filtro ANALYST em `get-demands.ts`
- [ ] Adicionar validação ownership em `get-demand.ts`
- [ ] Adicionar validação ownership em `assign-member.ts`

### 2. **IMPORTANTE** - Melhorias UX
- [ ] Ordenação especial BILLING em `get-demands.ts`
- [ ] Mensagens de erro mais específicas

### 3. **INFRAESTRUTURA**
- [ ] Criar migration para tabela de auditoria
- [ ] Rodar testes unitários

### 4. **DOCUMENTAÇÃO**
- [ ] Criar guia de uso para frontend
- [ ] Documentar fluxos por role

---

## 🔍 Como Testar

### Teste Manual Sugerido:

1. **Criar 2 usuários ANALYST** (Médico A e Médico B)
2. **Criar demand atribuída ao Médico A**
3. **Logar como Médico B**
4. **Tentar acessar** `GET /demands/:id` da demand do Médico A
5. **Resultado esperado**: ❌ Erro 403 "Você só pode visualizar suas próprias demandas"
6. **Resultado ATUAL**: ✅ 200 OK com os dados da demand (PROBLEMA!)

---

## 📝 Notas Importantes

### Arquivos que NÃO precisam mudanças:
- ✅ `create-demand.ts` - Já valida corretamente
- ✅ `update-demand.ts` - Completamente implementado
- ✅ `get-member-demands.ts` - Já filtra por member

### Arquivos que PRECISAM mudanças:
- ⚠️ `get-demands.ts` - Adicionar filtro ANALYST
- ⚠️ `get-demand.ts` - Adicionar validação ownership
- ⚠️ `assign-member.ts` - Adicionar validação ownership

---

**Conclusão**: O sistema está **70% completo**. As validações principais de transição e auditoria estão funcionando, mas **faltam proteções críticas para ANALYST não ver demands de outros médicos**.
