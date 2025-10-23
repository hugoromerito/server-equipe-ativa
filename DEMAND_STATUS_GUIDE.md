# 📋 Guia de Status de Demandas

## 🔄 Fluxo de Status

### Status Disponíveis

1. **PENDING** (Pendente)
   - Demanda criada, aguardando triagem
   - Paciente ainda não chegou na unidade
   
2. **CHECK_IN** (Check-in Realizado) ⭐ NOVO
   - Paciente chegou na unidade e fez check-in
   - Aguardando ser chamado pelo profissional
   - Status intermediário entre chegada e atendimento
   
3. **IN_PROGRESS** (Em Andamento)
   - Paciente está sendo atendido
   - Profissional está trabalhando na demanda
   - **Emite evento WebSocket `patient-called`**
   
4. **RESOLVED** (Resolvida)
   - Atendimento finalizado
   - Demanda concluída com sucesso
   
5. **REJECTED** (Rejeitada)
   - Demanda cancelada ou recusada
   - Pode ser reativada voltando para PENDING
   
6. **BILLED** (Faturada)
   - Status final
   - Demanda foi faturada
   - Não pode ser alterado

## 🔀 Transições Válidas

### Fluxo Normal (Recomendado)

```
PENDING → CHECK_IN → IN_PROGRESS → RESOLVED → BILLED
```

### Todas as Transições Permitidas

```
PENDING
  ├─→ CHECK_IN
  └─→ REJECTED

CHECK_IN
  ├─→ IN_PROGRESS
  ├─→ PENDING
  └─→ REJECTED

IN_PROGRESS
  ├─→ RESOLVED
  ├─→ REJECTED
  └─→ CHECK_IN

RESOLVED
  ├─→ BILLED
  └─→ IN_PROGRESS

REJECTED
  ├─→ PENDING
  └─→ CHECK_IN

BILLED
  └─→ (final, não pode mudar)
```

## 📝 Casos de Uso

### Caso 1: Fluxo Completo Normal

```
1. Recepção cria demanda → PENDING
2. Paciente chega na unidade → CHECK_IN
3. Profissional chama paciente → IN_PROGRESS (TV mostra chamada)
4. Atendimento finalizado → RESOLVED
5. Financeiro fatura → BILLED
```

### Caso 2: Paciente Não Compareceu

```
1. Demanda criada → PENDING
2. Paciente deveria chegar → CHECK_IN
3. Não compareceu → REJECTED
```

### Caso 3: Re-atendimento

```
1. Atendimento concluído → RESOLVED
2. Precisa de nova consulta → IN_PROGRESS
3. Finalizado novamente → RESOLVED
4. Faturado → BILLED
```

## 🔌 Integração com WebSocket

### Status que Acionam Eventos

Apenas o status **IN_PROGRESS** emite evento WebSocket para a TV:

```typescript
// Quando muda para IN_PROGRESS
socket.emit('patient-called', {
  patientName: "João Silva",
  memberName: "Dra. Maria",
  jobTitle: "Psicóloga",
  status: "IN_PROGRESS",
  priority: "HIGH"
})
```

### Exemplo de Uso na TV

```typescript
socket.on('patient-called', (data) => {
  if (data.status === 'IN_PROGRESS') {
    mostrarChamadaNaTela(data.patientName, data.memberName)
  }
})
```

## 📊 Dashboard - Contadores Sugeridos

```typescript
// Exemplo de contadores por status
{
  pending: 5,      // Aguardando triagem
  check_in: 3,     // Na unidade, aguardando
  in_progress: 2,  // Em atendimento agora
  resolved: 120,   // Concluídos hoje
  rejected: 8,     // Cancelados
  billed: 100      // Faturados
}
```

## 🎨 Cores Recomendadas (UI)

```css
.status-pending { color: #6c757d; }      /* Cinza */
.status-check-in { color: #ffc107; }     /* Amarelo */
.status-in-progress { color: #007bff; }  /* Azul */
.status-resolved { color: #28a745; }     /* Verde */
.status-rejected { color: #dc3545; }     /* Vermelho */
.status-billed { color: #17a2b8; }       /* Ciano */
```

## 🔒 Permissões Sugeridas

| Status | Quem Pode Mudar |
|--------|----------------|
| PENDING → CHECK_IN | Recepção, Admin |
| CHECK_IN → IN_PROGRESS | Profissional, Admin |
| IN_PROGRESS → RESOLVED | Profissional, Admin |
| RESOLVED → BILLED | Financeiro, Admin |
| * → REJECTED | Qualquer um com permissão |

## 🚀 Exemplo de API

### Atualizar Status

```bash
# Paciente chegou
curl -X PATCH /organizations/org/units/unit/demands/{id} \
  -H "Authorization: Bearer {token}" \
  -d '{"status": "CHECK_IN"}'

# Chamar paciente (emite evento WebSocket)
curl -X PATCH /organizations/org/units/unit/demands/{id} \
  -H "Authorization: Bearer {token}" \
  -d '{"status": "IN_PROGRESS"}'

# Finalizar atendimento
curl -X PATCH /organizations/org/units/unit/demands/{id} \
  -H "Authorization: Bearer {token}" \
  -d '{"status": "RESOLVED"}'
```

## 📱 Interface Sugerida

### Botões de Ação por Status

**Quando PENDING:**
- [ ] Fazer Check-in (→ CHECK_IN)
- [ ] Cancelar (→ REJECTED)

**Quando CHECK_IN:**
- [ ] Chamar Paciente (→ IN_PROGRESS)
- [ ] Voltar para Pendente (→ PENDING)
- [ ] Cancelar (→ REJECTED)

**Quando IN_PROGRESS:**
- [ ] Finalizar Atendimento (→ RESOLVED)
- [ ] Voltar para Check-in (→ CHECK_IN)

**Quando RESOLVED:**
- [ ] Faturar (→ BILLED)
- [ ] Re-atender (→ IN_PROGRESS)

## 🧪 Testes

```bash
# 1. Criar demanda
POST /demands → status: PENDING

# 2. Paciente chega
PATCH /demands/{id} → status: CHECK_IN

# 3. Verificar se não emitiu WebSocket
# (só emite em IN_PROGRESS)

# 4. Chamar paciente
PATCH /demands/{id} → status: IN_PROGRESS

# 5. Verificar evento WebSocket na TV
# Deve mostrar: "João Silva - Dra. Maria"

# 6. Finalizar
PATCH /demands/{id} → status: RESOLVED
```

## ❌ Transições Inválidas

Estas transições retornarão erro:

```
❌ PENDING → IN_PROGRESS (pular CHECK_IN)
❌ CHECK_IN → RESOLVED (pular IN_PROGRESS)
❌ PENDING → BILLED (pular etapas)
❌ BILLED → * (status final)
```

## 📚 Referências

- `src/db/schema/enums.ts` - Definição dos status
- `src/http/utils/validate-demand-status.ts` - Validação de transições
- `WEBSOCKET_GUIDE.md` - Sistema WebSocket

---

**Atualizado:** 23/10/2025 - Adicionado status CHECK_IN
