# 🎁 Sistema de Trial - Equipe Ativa

## 📋 Visão Geral

O sistema de trial permite que novos usuários experimentem a plataforma **gratuitamente** por um período determinado, com acesso completo aos recursos do plano escolhido.

## 🎯 Como Funciona

### Status da Assinatura durante Trial

```typescript
subscription.status = 'trialing'
```

Durante o período de trial:
- ✅ **Acesso total** aos recursos do plano
- ✅ **Todos os limites** do plano aplicados
- ✅ **Sem cobrança** durante o período
- ✅ Sistema funciona **exatamente igual** ao plano pago

### Após Trial Expirar

Automaticamente:
- Status muda de `trialing` → `active` ou `past_due`
- Primeira cobrança é processada
- Se pagamento falhar → acesso bloqueado

---

## 📊 Planos e Períodos de Trial

| Plano | Trial | Preço/mês | Incluso no Trial |
|-------|-------|-----------|------------------|
| **Gratuito** | ❌ 0 dias | R$ 0,00 | Acesso permanente (não é trial) |
| **Básico** | ✅ 14 dias | R$ 99,00 | Tudo do plano Básico |
| **Profissional** | ✅ 14 dias | R$ 299,00 | Tudo do plano Profissional |
| **Empresarial** | ✅ 30 dias | R$ 999,00 | Tudo do plano Empresarial |

---

## 🎁 Plano Básico - Trial de 14 Dias

### O que está incluso no trial:

#### 👥 Membros e Equipe
- ✅ Até **20 membros** (funcionários, médicos, recepcionistas)
- ✅ Gerenciamento completo de usuários
- ✅ Controle de horários e disponibilidade
- ✅ Folha de ponto digital
- ✅ Sistema de permissões (5 roles)

#### 🏥 Unidades
- ✅ Até **5 unidades** (clínicas/filiais)
- ✅ Gerenciamento independente por unidade
- ✅ Transferência de propriedade
- ✅ Configuração personalizada por unidade

#### 📋 Demandas (Atendimentos)
- ✅ Até **200 demandas por mês**
- ✅ Sistema completo de agendamento
- ✅ Fluxo de status (Pending → Check-in → In Progress → Resolved → Billed)
- ✅ Atribuição de profissionais
- ✅ Histórico completo

#### 👤 Pacientes (Applicants)
- ✅ Cadastro ilimitado de pacientes
- ✅ Dados completos (CPF, endereço, contatos)
- ✅ Histórico de atendimentos
- ✅ Upload de documentos

#### 💾 Armazenamento
- ✅ **10 GB de espaço**
- ✅ Upload de documentos
- ✅ Upload de imagens
- ✅ Avatares personalizados
- ✅ Arquivos médicos
- ✅ Documentos de identidade

#### 📊 Recursos Adicionais
- ✅ Relatórios básicos
- ✅ Suporte prioritário (durante trial)
- ✅ Sistema de convites
- ✅ Notificações por email
- ✅ WebSockets em tempo real
- ✅ API REST completa

#### 🔐 Segurança
- ✅ Autenticação JWT
- ✅ Sistema de permissões completo (RBAC)
- ✅ Auditoria de ações
- ✅ Controle de acesso por role
- ✅ Criptografia de dados sensíveis

---

## 🚀 Plano Profissional - Trial de 14 Dias

### Tudo do Básico +

#### 👥 Capacidade Expandida
- ✅ Até **100 membros**
- ✅ Até **20 unidades**
- ✅ Até **1000 demandas por mês**
- ✅ **50 GB de armazenamento**

#### 📈 Recursos Avançados
- ✅ **Relatórios avançados**
  - Análise de produtividade
  - Métricas de atendimento
  - Relatórios personalizados
  - Exportação em múltiplos formatos

- ✅ **API Access**
  - Acesso completo à API REST
  - Documentação técnica
  - Rate limits aumentados

- ✅ **Webhooks personalizados**
  - Integração com sistemas externos
  - Notificações em tempo real
  - Configuração flexível

- ✅ **Suporte prioritário 24/7**
  - Chat em tempo real
  - Resposta em até 1 hora
  - Suporte técnico especializado

---

## 💼 Plano Empresarial - Trial de 30 Dias

### Tudo do Profissional +

#### 🔥 Recursos Ilimitados
- ✅ **Membros ilimitados**
- ✅ **Unidades ilimitadas**
- ✅ **Demandas ilimitadas**
- ✅ **500 GB de armazenamento**

#### 🎯 Recursos Exclusivos
- ✅ **SLA garantido** (99.9% uptime)
- ✅ **Suporte dedicado** 24/7
  - Gerente de conta exclusivo
  - Canais prioritários de comunicação
  - Suporte por telefone

- ✅ **Treinamento da equipe**
  - Onboarding personalizado
  - Sessões de treinamento ao vivo
  - Material didático exclusivo
  - Suporte de implementação

- ✅ **Relatórios personalizados**
  - Dashboards customizados
  - Métricas específicas do negócio
  - Integrações com BI

- ✅ **API access completo**
  - Rate limits customizados
  - Endpoints exclusivos
  - Prioridade em requisições

---

## ⚙️ Como Funciona Tecnicamente

### 1. Criação da Assinatura com Trial

```typescript
// Ao criar organização, usuário escolhe plano
const subscription = await billingService.createSubscription({
  organization_id: 'org-123',
  plan_id: 'plan-basic',
  // trial_days é automático do plano (14 dias)
})

// Sistema cria subscription com status 'trialing'
{
  status: 'trialing',
  trial_end: new Date('2025-12-09'), // 14 dias depois
  current_period_start: new Date('2025-11-25'),
  current_period_end: new Date('2025-12-25')
}
```

### 2. Durante o Trial

```typescript
// Sistema verifica assinatura ativa
const subscription = await billingService.getActiveSubscription(orgId)

// Status 'trialing' é considerado ATIVO
if (subscription.status === 'trialing' || subscription.status === 'active') {
  // ✅ Usuário tem acesso completo
}

// Limites são aplicados NORMALMENTE
const limitCheck = await usageTrackingService.canCreateResource(orgId, 'member')
if (!limitCheck.allowed) {
  // ❌ Atingiu limite do plano (mesmo no trial)
}
```

### 3. Fim do Trial

**Webhook do Stripe dispara:**

```typescript
// stripe-webhook.ts
switch (event.type) {
  case 'customer.subscription.trial_will_end':
    // 3 dias antes: envia email avisando
    await sendTrialEndingEmail(subscription)
    break
    
  case 'customer.subscription.updated':
    // Trial terminou
    if (stripeSubscription.status === 'active') {
      // ✅ Pagamento OK → subscription.status = 'active'
      await updateSubscriptionStatus(subscription.id, 'active')
    } else if (stripeSubscription.status === 'past_due') {
      // ❌ Pagamento falhou → subscription.status = 'past_due'
      await updateSubscriptionStatus(subscription.id, 'past_due')
      await blockOrganizationAccess(organization.id)
    }
    break
}
```

---

## 🎨 Experiência do Usuário

### Fluxo Completo do Trial

```
📅 Dia 0 - Início
├─> Usuário se registra
├─> Escolhe plano (ex: Básico - R$ 99/mês)
├─> Adiciona método de pagamento
└─> Trial de 14 dias começa automaticamente

📅 Dia 1-10 - Uso Normal
├─> Status: 'trialing'
├─> Acesso total ao plano
├─> Limites aplicados (20 membros, 5 unidades, etc)
└─> Sem cobrança

📅 Dia 11 - Aviso de Término
├─> Email: "Seu trial termina em 3 dias"
├─> Banner no dashboard
└─> Opção de cancelar antes da cobrança

📅 Dia 14 - Fim do Trial
├─> Sistema tenta cobrar R$ 99,00
│
├─> Se pagamento OK ✅
│   ├─> Status: 'trialing' → 'active'
│   ├─> Acesso continua normalmente
│   └─> Próxima cobrança em 30 dias
│
└─> Se pagamento falha ❌
    ├─> Status: 'trialing' → 'past_due'
    ├─> Acesso bloqueado
    └─> Email com instruções para atualizar pagamento
```

---

## 💡 Casos de Uso do Trial

### Caso 1: Clínica Pequena Testando

**Perfil:**
- 3 médicos
- 1 recepcionista
- 1 unidade
- ~50 atendimentos/mês

**Trial Recomendado:** Plano Básico (14 dias)

**Durante o trial:**
- ✅ Cadastra 4 membros (de 20 permitidos)
- ✅ Cria 1 unidade (de 5 permitidas)
- ✅ Registra ~25 atendimentos (de 200 permitidos)
- ✅ Usa ~500 MB (de 10 GB)
- ✅ Testa relatórios e workflow completo

**Resultado:** Consegue avaliar 100% do sistema

---

### Caso 2: Rede de Clínicas Grande

**Perfil:**
- 50 profissionais
- 10 unidades
- ~500 atendimentos/mês

**Trial Recomendado:** Plano Profissional (14 dias)

**Durante o trial:**
- ✅ Cadastra 50 membros (de 100 permitidos)
- ✅ Cria 10 unidades (de 20 permitidas)
- ✅ Registra ~250 atendimentos (de 1000 permitidos)
- ✅ Testa API e webhooks
- ✅ Configura integrações

**Resultado:** Valida escalabilidade e recursos avançados

---

## 🔐 Controle de Acesso Durante Trial

### Status 'trialing' é considerado ATIVO

```typescript
// src/http/middlewares/billing.ts
const ALLOWED_STATUSES = ['active', 'trialing']

export async function requireActiveSubscription(request, reply) {
  const subscription = await billingService.getActiveSubscription(orgId)
  
  if (!subscription) {
    return reply.status(403).send({
      code: 'NO_ACTIVE_SUBSCRIPTION'
    })
  }
  
  // ✅ Trial permite acesso total
  if (ALLOWED_STATUSES.includes(subscription.status)) {
    // Continua normalmente
  }
}
```

### Limites Aplicados Durante Trial

```typescript
// Limites são SEMPRE verificados, trial ou não
const limitCheck = await usageTrackingService.canCreateResource(orgId, 'member')

// Durante trial do Plano Básico:
{
  allowed: true/false,
  current: 15,      // membros atuais
  limit: 20,        // limite do plano Básico
}
```

---

## 📧 Comunicações Durante Trial

### Emails Automáticos

1. **Boas-vindas** (Dia 0)
   - Confirmação de trial iniciado
   - Guia rápido de uso
   - Links para tutoriais

2. **Meio do trial** (Dia 7)
   - "Como está sendo sua experiência?"
   - Dicas de uso avançado
   - Oferta de demo ao vivo

3. **Aviso de término** (Dia 11)
   - "Seu trial termina em 3 dias"
   - Lembrete sobre cobrança
   - Opção de cancelar

4. **Último dia** (Dia 14)
   - "Seu trial termina hoje"
   - Confirmação de método de pagamento
   - Suporte para dúvidas

5. **Após conversão** (Dia 15)
   - "Bem-vindo como cliente!"
   - Nota fiscal da primeira cobrança
   - Benefícios exclusivos

---

## 🚫 O que NÃO está no Trial

### Limitações Técnicas

❌ **Plano Gratuito não tem trial**
- É permanente, não expira
- Limites reduzidos (5 membros, 2 unidades)

❌ **Trial não pode ser renovado**
- Apenas 1 trial por organização
- Baseado no email do owner

❌ **Recursos enterprise específicos**
- Gerente de conta dedicado (apenas após pagamento)
- SLA garantido (requer contrato)
- Treinamento presencial (agendado após assinatura)

---

## ⚙️ Configuração do Trial

### Como Alterar Período de Trial

```typescript
// 1. Via banco de dados (seed-plans.ts)
{
  name: 'Básico',
  slug: 'basic',
  trial_days: 14,  // ← Alterar aqui
  // ...
}

// 2. Via Stripe Dashboard
// Products → Select Plan → Pricing → Default trial days

// 3. Programaticamente ao criar subscription
await billingService.createSubscription({
  organization_id: 'org-123',
  plan_id: 'plan-basic',
  trial_days: 30,  // ← Override do padrão
})
```

---

## 📊 Métricas de Trial

### Para Análise de Negócio

**Métricas importantes:**
- Taxa de conversão trial → pagamento
- Uso médio durante trial (membros, demandas, storage)
- Taxa de cancelamento durante trial
- Recursos mais usados no trial
- Tempo médio para primeira ação

**Query para análise:**
```sql
-- Subscriptions que estão em trial
SELECT 
  o.name as organization_name,
  s.status,
  s.trial_end,
  DATEDIFF(day, NOW(), s.trial_end) as days_remaining
FROM subscriptions s
JOIN organizations o ON s.organization_id = o.id
WHERE s.status = 'trialing'
ORDER BY s.trial_end ASC;
```

---

## ✅ Checklist de Trial

### Para Usuário
- [ ] Criar conta
- [ ] Escolher plano com trial
- [ ] Adicionar método de pagamento
- [ ] Testar principais funcionalidades
- [ ] Convidar membros da equipe
- [ ] Criar demandas de teste
- [ ] Avaliar relatórios
- [ ] Decidir: continuar ou cancelar

### Para Desenvolvedor
- [x] Sistema de trial implementado
- [x] Status 'trialing' tratado como ativo
- [x] Limites aplicados durante trial
- [x] Webhook de fim de trial
- [x] Bloqueio após trial expirado sem pagamento
- [ ] Emails automáticos configurados
- [ ] Analytics de trial implementado
- [ ] Dashboard de métricas de conversão

---

## 🎯 Conclusão

O sistema de trial oferece:

✅ **Acesso completo** aos recursos do plano escolhido
✅ **Período adequado** para avaliar (14-30 dias)
✅ **Sem cobrança** durante experimentação
✅ **Limites realistas** para validar o sistema
✅ **Conversão automática** para plano pago
✅ **Controle total** do usuário (pode cancelar)

**Objetivo:** Permitir que o cliente avalie 100% do sistema antes de pagar, com a certeza de que o que ele testa é exatamente o que terá no plano pago.

---

**Última atualização:** 25 de novembro de 2025  
**Versão:** 1.0.0
