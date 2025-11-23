# ✅ Aplicação das Permissões nas Rotas - Resumo

## 📋 Rotas Atualizadas

### 1. ✅ **`update-demand.ts`** - Atualizar Demanda
**Caminho**: `/organizations/:slug/units/:unitSlug/demands/:demandId`

**Mudanças Aplicadas:**
- ✅ Substituído `isValidStatusTransition` por `validateCompleteStatusTransition`
- ✅ Adicionado validação especial para ANALYST (só pode atualizar demands atribuídas a ele)
- ✅ Adicionado sistema de auditoria com `logDemandStatusChange`
- ✅ Adicionado campo `reason` no schema do body
- ✅ Registra IP, userAgent e metadata na auditoria

**Validações Implementadas:**
```typescript
// 1. Verifica permissão básica de update
if (cannot('update', 'Demand')) { throw error }

// 2. Para ANALYST: verifica se demand está atribuída a ele
if (userRole === 'ANALYST' && demand.responsible_id !== membership.id) { throw error }

// 3. Valida transição de status (fluxo + permissões por role)
validateCompleteStatusTransition(userRole, currentStatus, newStatus)

// 4. Registra auditoria se status mudou
await logDemandStatusChange({ ... })
```

---

### 2. ✅ **`assign-member.ts`** - Atribuir Profissional
**Caminho**: `/organizations/:slug/units/:unitSlug/demands/:demandId/assign`

**Mudanças Aplicadas:**
- ✅ Adicionado sistema de auditoria quando status muda de PENDING → IN_PROGRESS
- ✅ Registra informações do profissional atribuído nos metadados
- ✅ Registra data e hora do agendamento na auditoria

**Validações Implementadas:**
```typescript
// 1. Verifica permissão de update
if (cannot('update', 'Demand')) { throw error }

// 2. Valida disponibilidade do profissional
const validation = await validateMemberScheduling(...)

// 3. Registra auditoria se status mudou
if (previousStatus !== newStatus) {
  await logDemandStatusChange({
    reason: `Profissional atribuído: ${memberName}`,
    metadata: { responsibleId, scheduledDate, scheduledTime }
  })
}
```

---

### 3. ✅ **`update-demand-status.example.ts`** - Exemplo Completo
**Caminho**: Arquivo de exemplo mostrando integração completa

**Funcionalidades Demonstradas:**
- ✅ Validação completa de permissões CASL
- ✅ Validação de transições de status
- ✅ Validação especial para ANALYST
- ✅ Sistema de auditoria completo
- ✅ Tratamento de erros específicos
- ✅ Metadados ricos (IP, userAgent, unitId, etc.)

---

## 📊 Resumo das Validações por Rota

| Rota | Validação CASL | Validação Transição | Validação ANALYST | Auditoria |
|------|---------------|---------------------|-------------------|-----------|
| `update-demand.ts` | ✅ | ✅ | ✅ | ✅ |
| `assign-member.ts` | ✅ | N/A* | ❌ | ✅ |
| `create-demand.ts` | ✅ | N/A** | ❌ | ❌*** |

*N/A: Não aplicável - Atribuir membro não valida transição manualmente, apenas muda PENDING→IN_PROGRESS  
**N/A: Criar demand sempre inicia com status PENDING  
***Não precisa: Criar demand não muda status

---

## 🔐 Matriz de Permissões Aplicada

### Por Role - O que cada um pode fazer:

#### **ADMIN**
- ✅ Pode atualizar qualquer demand
- ✅ Pode fazer qualquer transição de status (exceto para/de REJECTED)
- ✅ Pode atribuir profissionais

#### **MANAGER (RH)**
- ✅ Pode criar applicants e demands
- ✅ Pode visualizar demands
- ❌ **NÃO pode** alterar status diretamente

#### **CLERK (Recepcionista)**
- ✅ Pode criar applicants e demands
- ✅ Pode atualizar demands
- ✅ Pode atribuir profissionais
- ✅ Pode alterar status: PENDING→CHECK_IN, CHECK_IN→IN_PROGRESS, IN_PROGRESS→RESOLVED
- ❌ **NÃO pode** alterar para BILLED

#### **ANALYST (Médico)**
- ✅ Pode atualizar **APENAS** demands atribuídas a ele
- ✅ Pode alterar status: CHECK_IN→IN_PROGRESS, IN_PROGRESS→RESOLVED
- ❌ **NÃO pode** criar demands
- ❌ **NÃO pode** atribuir profissionais
- ❌ **NÃO pode** alterar demands de outros médicos

#### **BILLING (Faturista)**
- ✅ Pode visualizar todas demands
- ✅ Pode alterar status: RESOLVED→BILLED
- ❌ **NÃO pode** alterar outros status
- ❌ **NÃO pode** criar demands

---

## 📝 Logs de Auditoria Registrados

Cada mudança de status registra:

```json
{
  "demand_id": "uuid",
  "previous_status": "CHECK_IN",
  "new_status": "IN_PROGRESS",
  "changed_by_user_id": "uuid",
  "changed_by_member_id": "uuid",
  "changed_by_user_name": "Dr. João Silva",
  "changed_by_role": "ANALYST",
  "reason": "Iniciando consulta com paciente",
  "metadata": {
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "unitId": "uuid",
    "organizationId": "uuid",
    "responsibleId": "uuid",      // Apenas em assign-member
    "scheduledDate": "2025-10-24", // Apenas em assign-member
    "scheduledTime": "14:30"       // Apenas em assign-member
  },
  "changed_at": "2025-10-24T14:30:00Z"
}
```

---

## 🎯 Benefícios Implementados

### 1. **Segurança**
- ✅ Múltiplas camadas de validação
- ✅ Permissões granulares por role
- ✅ Validação de propriedade (ANALYST só vê suas demands)

### 2. **Rastreabilidade**
- ✅ Histórico completo de mudanças
- ✅ Quem fez, quando e por quê
- ✅ Metadados para investigação

### 3. **Compliance**
- ✅ LGPD: Rastreabilidade de acesso
- ✅ Auditoria médica: Registro de atendimentos
- ✅ Regulamentação: Logs permanentes

### 4. **UX/DX**
- ✅ Mensagens de erro específicas
- ✅ Validação antes de salvar no banco
- ✅ Código limpo e reutilizável

---

## 🚧 Próximos Passos Recomendados

### 1. **Criar Migration para Tabela de Auditoria**
```bash
npm run db:generate
npm run db:migrate
```

### 2. **Criar Endpoints de Consulta**
```typescript
// GET /demands/:id/history
// GET /users/:id/audit-log
// GET /reports/status-changes
```

### 3. **Atualizar Rotas Restantes (Opcional)**
- `get-demand.ts` - Adicionar validação de ANALYST (só vê suas demands)
- `get-demands.ts` - Filtrar demands por ANALYST automaticamente
- `get-member-demands.ts` - Já está filtrado por member

### 4. **Frontend**
- Consumir histórico de auditoria
- Mostrar timeline de mudanças
- Campo de "motivo" ao alterar status
- Validar transições antes de enviar ao backend

### 5. **Testes**
- Testar cada role em cada rota
- Testar validações de transição
- Testar auditoria sendo registrada

---

## 📦 Arquivos Modificados

```
src/
├── http/routes/demands/
│   ├── update-demand.ts ✏️ (atualizado)
│   ├── assign-member.ts ✏️ (atualizado)
│   └── update-demand-status.example.ts ✨ (novo - exemplo)
├── utils/
│   ├── demand-status-transitions.ts ✨ (novo)
│   └── audit-logger.ts ✨ (novo)
└── db/schema/
    ├── audit.ts ✨ (novo)
    └── index.ts ✏️ (atualizado)
```

---

**Data**: 24 de outubro de 2025  
**Status**: ✅ Implementado  
**Cobertura**: 2 rotas principais + 1 exemplo  
**Testes**: Pendente (criar testes de integração)
