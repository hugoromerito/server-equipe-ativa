# 🔒 Análise: Acesso à Rota TV por Código de 6 Caracteres

**Data:** 30 de outubro de 2025  
**Status:** ✅ Viável e Seguro  
**Prioridade:** 🟢 Recomendado

---

## 📋 Sumário Executivo

**Proposta:** Criar um sistema de acesso à rota de TV sem necessidade de login, utilizando um código de 6 caracteres gerado pelo usuário administrador.

**Veredicto:** ✅ **VIÁVEL E POLITICAMENTE CORRETO**

### Por que é seguro?

1. ✅ **Dados não sensíveis**: TV exibe apenas nomes públicos (paciente + médico)
2. ✅ **Temporário**: Códigos podem expirar automaticamente
3. ✅ **Revogável**: Admin pode invalidar códigos a qualquer momento
4. ✅ **Isolado por unidade**: Cada TV vê apenas sua unidade
5. ✅ **Somente leitura**: TV não pode alterar dados, apenas visualizar
6. ✅ **LGPD Compliant**: Não expõe CPF, endereço, histórico médico

---

## 🎯 Casos de Uso

### Cenário Real
```
📺 TV na recepção da Clínica Centro
👤 Admin gera código: "ABC123"
⏰ Válido por: 30 dias
🔒 Escopo: Somente Unidade "Centro"

Quando TV é ligada:
1. Tela de entrada: "Insira código de acesso"
2. Digitam: ABC123
3. ✅ Conectado automaticamente
4. 🔔 Recebe chamadas em tempo real
```

---

## 🔐 Segurança e Conformidade

### ✅ Conformidade LGPD

#### Dados Expostos na TV
| Dado | Sensível? | Justificativa |
|------|-----------|---------------|
| Nome do paciente | ❌ NÃO | Chamada pública em recepção |
| Nome do médico | ❌ NÃO | Informação pública da clínica |
| Cargo do médico | ❌ NÃO | Informação profissional |
| Prioridade | ❌ NÃO | Não identifica condição médica |

#### Dados NÃO Expostos
- ✅ CPF
- ✅ Endereço
- ✅ Telefone
- ✅ Histórico médico
- ✅ Diagnósticos
- ✅ Documentos anexados

**Conclusão LGPD:** ✅ **Conforme** - Dados equivalentes a uma "chamada de senha" em recepção física.

---

### 🔒 Medidas de Segurança

#### 1. Tokens Temporários
```typescript
// Código expira automaticamente
{
  code: "ABC123",
  expiresAt: "2025-11-30T23:59:59Z",
  status: "ACTIVE" | "EXPIRED" | "REVOKED"
}
```

#### 2. Escopo Limitado
- ✅ **Organização-específico**: Código só funciona na org que o criou
- ✅ **Unidade-específica**: TV vê apenas pacientes da sua unidade
- ✅ **Somente leitura**: Não pode criar, editar ou deletar

#### 3. Auditoria
```typescript
// Registro de uso
{
  code: "ABC123",
  usedAt: "2025-10-30T10:00:00Z",
  ipAddress: "192.168.1.100",
  location: "Recepção Centro",
  lastActivity: "2025-10-30T15:30:00Z"
}
```

#### 4. Limitação de Taxa (Rate Limiting)
```typescript
// Prevenir força bruta
- Máximo 5 tentativas por minuto
- Bloqueio de IP após 10 tentativas inválidas
- Notificação ao admin de tentativas suspeitas
```

---

## 🏗️ Arquitetura Proposta

### 1. Nova Tabela no Banco de Dados

```sql
-- Migration: 0010_tv_access_tokens.sql
CREATE TABLE tv_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Código de 6 caracteres (alfanumérico)
  code VARCHAR(6) UNIQUE NOT NULL,
  
  -- Relacionamentos
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  
  -- Metadados
  name VARCHAR(100) NOT NULL, -- Ex: "TV Recepção Centro"
  description TEXT,
  
  -- Status e validade
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, REVOKED
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by_user_id UUID REFERENCES users(id),
  
  -- Controle de uso
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_ip_address VARCHAR(45), -- IPv6
  usage_count INTEGER DEFAULT 0,
  
  -- Índices para performance
  CONSTRAINT tv_access_tokens_code_key UNIQUE (code),
  INDEX idx_tv_access_tokens_status (status),
  INDEX idx_tv_access_tokens_organization (organization_id),
  INDEX idx_tv_access_tokens_unit (unit_id)
);

-- Enum para status
CREATE TYPE tv_token_status AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
```

---

### 2. Endpoints da API

#### **POST `/organizations/:slug/units/:unitSlug/tv-tokens`**
Criar novo código de acesso (Admin/Manager apenas)

```typescript
// Request
{
  "name": "TV Recepção Centro",
  "description": "TV principal da recepção",
  "expiresInDays": 30 // opcional, default: 90 dias
}

// Response 201
{
  "token": {
    "id": "uuid",
    "code": "ABC123",
    "name": "TV Recepção Centro",
    "organizationSlug": "clinica-saude",
    "unitSlug": "centro",
    "expiresAt": "2025-11-30T23:59:59Z",
    "createdAt": "2025-10-30T10:00:00Z"
  }
}
```

**Permissões:** ADMIN, MANAGER

---

#### **GET `/organizations/:slug/units/:unitSlug/tv-tokens`**
Listar todos os códigos da unidade

```typescript
// Response 200
{
  "tokens": [
    {
      "id": "uuid",
      "code": "ABC123",
      "name": "TV Recepção Centro",
      "status": "ACTIVE",
      "expiresAt": "2025-11-30T23:59:59Z",
      "lastUsedAt": "2025-10-30T15:30:00Z",
      "usageCount": 142,
      "createdBy": "João Admin"
    }
  ]
}
```

**Permissões:** ADMIN, MANAGER, CLERK

---

#### **POST `/tv/validate`** ⭐ (Rota Pública)
Validar código e obter token WebSocket

```typescript
// Request (SEM autenticação JWT)
{
  "code": "ABC123"
}

// Response 200
{
  "valid": true,
  "session": {
    "organizationSlug": "clinica-saude",
    "unitSlug": "centro",
    "sessionToken": "temp-jwt-token-for-websocket",
    "expiresIn": 3600 // segundos
  }
}

// Response 401 (código inválido)
{
  "valid": false,
  "message": "Código inválido ou expirado"
}
```

**Permissões:** ⭐ **Pública** (não requer JWT)

---

#### **DELETE `/organizations/:slug/units/:unitSlug/tv-tokens/:tokenId`**
Revogar código de acesso

```typescript
// Response 204 No Content
```

**Permissões:** ADMIN, MANAGER

---

### 3. Integração com WebSocket

#### Modificação no `socket-server.ts`

```typescript
// Permitir autenticação via TV token
io.use((socket, next) => {
  const authType = socket.handshake.auth.type // 'jwt' ou 'tv-token'
  
  if (authType === 'tv-token') {
    const tvToken = socket.handshake.auth.tvToken
    
    // Validar TV token
    const validToken = await validateTVToken(tvToken)
    
    if (!validToken) {
      return next(new Error('Token de TV inválido'))
    }
    
    // Armazenar contexto da TV
    socket.data.isTVSession = true
    socket.data.organizationSlug = validToken.organizationSlug
    socket.data.unitSlug = validToken.unitSlug
    socket.data.tvTokenId = validToken.id
    
    // Registrar uso
    await recordTVTokenUsage(validToken.id, socket.handshake.address)
    
    return next()
  }
  
  // Autenticação JWT normal para usuários
  // ... lógica existente
})

// Função de validação
async function validateTVToken(sessionToken: string) {
  try {
    const decoded = await verifyJWT(sessionToken, { 
      issuer: 'tv-session' 
    })
    
    // Buscar token no banco
    const token = await db
      .select()
      .from(tvAccessTokens)
      .where(
        and(
          eq(tvAccessTokens.id, decoded.tokenId),
          eq(tvAccessTokens.status, 'ACTIVE')
        )
      )
      .limit(1)
    
    if (!token[0]) return null
    
    // Verificar expiração
    if (token[0].expiresAt && new Date() > token[0].expiresAt) {
      await markTokenAsExpired(token[0].id)
      return null
    }
    
    return token[0]
  } catch {
    return null
  }
}
```

---

## 💻 Implementação Frontend

### 1. Página de Login da TV

```tsx
// app/tv/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TVLoginPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/tv/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase() })
      })

      const data = await response.json()

      if (data.valid) {
        // Salvar token no localStorage
        localStorage.setItem('tv-session', JSON.stringify(data.session))
        
        // Redirecionar para display
        router.push('/tv/display')
      } else {
        setError('Código inválido ou expirado')
      }
    } catch (error) {
      setError('Erro ao validar código')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">TV Display</h1>
          <p className="text-gray-600 mt-2">Insira o código de acesso</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none uppercase"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Validando...' : 'Conectar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

---

### 2. Página de Display da TV

```tsx
// app/tv/display/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'

interface TVSession {
  organizationSlug: string
  unitSlug: string
  sessionToken: string
  expiresIn: number
}

interface PatientCall {
  patientName: string
  memberName: string
  jobTitle: string | null
  priority: string
  calledAt: Date
}

export default function TVDisplayPage() {
  const [session, setSession] = useState<TVSession | null>(null)
  const [currentCall, setCurrentCall] = useState<PatientCall | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Recuperar sessão do localStorage
    const storedSession = localStorage.getItem('tv-session')
    
    if (!storedSession) {
      router.push('/tv')
      return
    }

    const parsedSession: TVSession = JSON.parse(storedSession)
    setSession(parsedSession)

    // Conectar ao WebSocket com TV token
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: {
        type: 'tv-token',
        tvToken: parsedSession.sessionToken
      },
      transports: ['websocket', 'polling']
    })

    socketInstance.on('connect', () => {
      console.log('✅ TV conectada ao WebSocket')
      
      // Entrar na sala da unidade
      socketInstance.emit('join-unit', {
        organizationSlug: parsedSession.organizationSlug,
        unitSlug: parsedSession.unitSlug
      })
    })

    socketInstance.on('patient-called', (data: PatientCall) => {
      console.log('🔔 Paciente chamado:', data)
      setCurrentCall(data)
      
      // Reproduzir som
      playNotificationSound()
      
      // Limpar após 15 segundos
      setTimeout(() => setCurrentCall(null), 15000)
    })

    socketInstance.on('disconnect', () => {
      console.log('❌ Desconectado do WebSocket')
    })

    socketInstance.on('error', (error) => {
      console.error('Erro no WebSocket:', error)
      // Se token expirou, voltar para login
      if (error.message.includes('inválido')) {
        localStorage.removeItem('tv-session')
        router.push('/tv')
      }
    })

    setSocket(socketInstance)

    // Cleanup
    return () => {
      socketInstance.disconnect()
    }
  }, [router])

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3')
    audio.play().catch(console.error)
  }

  if (!currentCall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-pulse mb-4">
            <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold">Aguardando Chamadas...</h1>
          <p className="text-xl mt-4 opacity-75">
            {session?.unitSlug.replace('-', ' ').toUpperCase()}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-blue-700 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-4xl w-full animate-fade-in">
        <div className="text-center">
          <div className="mb-6">
            <span className="inline-block px-6 py-2 bg-green-500 text-white rounded-full text-sm font-semibold">
              🔔 CHAMADA DE PACIENTE
            </span>
          </div>

          <h1 className="text-6xl font-bold text-gray-800 mb-8">
            {currentCall.patientName}
          </h1>

          <div className="border-t-2 border-gray-200 pt-8">
            <p className="text-2xl text-gray-600 mb-2">Profissional:</p>
            <p className="text-4xl font-semibold text-gray-800">
              {currentCall.memberName}
            </p>
            {currentCall.jobTitle && (
              <p className="text-xl text-gray-500 mt-2">
                {currentCall.jobTitle}
              </p>
            )}
          </div>

          {currentCall.priority === 'URGENT' && (
            <div className="mt-8 p-4 bg-red-100 border-2 border-red-500 rounded-lg">
              <p className="text-red-700 font-bold text-xl">
                ⚠️ ATENDIMENTO URGENTE
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

### 3. Interface Admin - Gerenciar Códigos

```tsx
// app/dashboard/tv-tokens/page.tsx
'use client'

import { useState, useEffect } from 'react'

export default function TVTokensPage() {
  const [tokens, setTokens] = useState([])
  const [showModal, setShowModal] = useState(false)
  
  const handleGenerateCode = async (formData: any) => {
    const response = await fetch(`/api/organizations/${orgSlug}/units/${unitSlug}/tv-tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    
    const data = await response.json()
    
    // Mostrar código gerado
    alert(`Código gerado: ${data.token.code}`)
    loadTokens()
  }
  
  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm('Deseja realmente revogar este código?')) return
    
    await fetch(`/api/organizations/${orgSlug}/units/${unitSlug}/tv-tokens/${tokenId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    
    loadTokens()
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Códigos de Acesso TV</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          + Gerar Código
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">Código</th>
              <th className="px-6 py-3 text-left">Nome</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Último Uso</th>
              <th className="px-6 py-3 text-left">Validade</th>
              <th className="px-6 py-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tokens.map(token => (
              <tr key={token.id}>
                <td className="px-6 py-4 font-mono font-bold text-lg">
                  {token.code}
                </td>
                <td className="px-6 py-4">{token.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    token.status === 'ACTIVE' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {token.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {token.lastUsedAt 
                    ? new Date(token.lastUsedAt).toLocaleString()
                    : 'Nunca'
                  }
                </td>
                <td className="px-6 py-4 text-sm">
                  {new Date(token.expiresAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleRevokeToken(token.id)}
                    className="text-red-600 hover:text-red-800 font-semibold"
                  >
                    Revogar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

## 📋 Checklist de Implementação

### Backend (Prioridade CRÍTICA 🔴)
- [ ] Criar migration `0010_tv_access_tokens.sql`
- [ ] Criar schema `tv-access-tokens.ts` no Drizzle
- [ ] Criar rota `POST /organizations/:slug/units/:unitSlug/tv-tokens`
- [ ] Criar rota `GET /organizations/:slug/units/:unitSlug/tv-tokens`
- [ ] Criar rota `DELETE /organizations/:slug/units/:unitSlug/tv-tokens/:id`
- [ ] Criar rota `POST /tv/validate` (pública, sem JWT)
- [ ] Modificar `socket-server.ts` para aceitar TV tokens
- [ ] Adicionar função `validateTVToken()`
- [ ] Adicionar auditoria de uso (IP, timestamp)
- [ ] Criar função de expiração automática (cron job)
- [ ] Adicionar rate limiting na rota `/tv/validate`
- [ ] Criar testes unitários para tokens
- [ ] Criar testes de integração WebSocket com TV token

### Frontend (Prioridade ALTA 🟡)
- [ ] Criar página `/tv` (login com código)
- [ ] Criar página `/tv/display` (exibição de chamadas)
- [ ] Criar página `/dashboard/tv-tokens` (admin)
- [ ] Implementar hook `useTVSession()`
- [ ] Adicionar validação de código no formulário
- [ ] Implementar reconexão automática WebSocket
- [ ] Adicionar tratamento de token expirado
- [ ] Adicionar som de notificação
- [ ] Criar animações de entrada/saída
- [ ] Testar em diferentes resoluções (TV 4K, HD)

### Documentação (Prioridade MÉDIA 🟢)
- [ ] Atualizar `WEBSOCKET_GUIDE.md` com TV tokens
- [ ] Criar `TV_SETUP_GUIDE.md` para clientes
- [ ] Documentar API no Swagger
- [ ] Criar vídeo tutorial de configuração
- [ ] Adicionar FAQ sobre segurança

---

## 🔍 Comparação com Alternativas

| Solução | Segurança | UX | Manutenibilidade |
|---------|-----------|----|--------------------|
| **Código 6 caracteres** ⭐ | ✅ Alta | ✅ Excelente | ✅ Simples |
| Login JWT completo | ✅ Muito Alta | ❌ Ruim (senha na TV) | ⚠️ Complexo |
| QR Code dinâmico | ✅ Alta | ⚠️ Médio (scan) | ⚠️ Médio |
| IP Whitelist | ⚠️ Média | ✅ Ótimo | ❌ Difícil (IPs mudam) |
| Sem autenticação | ❌ Baixa | ✅ Ótimo | ❌ Inseguro |

**Vencedor:** 🏆 Código de 6 caracteres

---

## 🚀 Roadmap de Implementação

### Sprint 1 (1 semana)
1. Criar tabela e migrations
2. Implementar rotas backend básicas
3. Adicionar validação de TV token no WebSocket

### Sprint 2 (1 semana)
1. Criar página de login da TV
2. Criar página de display
3. Integrar com WebSocket

### Sprint 3 (3 dias)
1. Criar interface admin de gerenciamento
2. Adicionar auditoria e logs
3. Implementar rate limiting

### Sprint 4 (2 dias)
1. Testes automatizados
2. Documentação
3. Deploy e validação

**Tempo total estimado:** 3-4 semanas

---

## 💡 Recomendações Adicionais

### 1. Formato do Código
```typescript
// Gerar código alfanumérico legível (evitar confusão I/1, O/0)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length))
  }
  return code
}

// Exemplo: AB2H7K (fácil de digitar e ler)
```

### 2. Boas Práticas
- ✅ Usar códigos curtos mas únicos (6 caracteres = 2,176,782,336 combinações)
- ✅ Evitar caracteres confusos (I/1, O/0, S/5)
- ✅ Expiração padrão de 90 dias (renovação trimestral)
- ✅ Máximo de 5 tokens ativos por unidade
- ✅ Notificar admin 7 dias antes da expiração
- ✅ Permitir renovação sem gerar novo código

### 3. Melhorias Futuras
- 📱 App mobile para gerar códigos via QR
- 🔔 Notificações push quando token está próximo de expirar
- 📊 Dashboard com analytics de uso (quantas chamadas, horários de pico)
- 🌐 Suporte multi-idioma na TV
- 🎨 Temas personalizáveis (cores da clínica)
- 📹 Suporte a múltiplas TVs com layout diferente

---

## ✅ Conclusão

**Implementar acesso via código de 6 caracteres é:**

✅ **Seguro**: Medidas de rate limiting, expiração e auditoria  
✅ **Conforme LGPD**: Dados não sensíveis, equivalente a chamada pública  
✅ **User-friendly**: Simples de usar, sem necessidade de senha  
✅ **Escalável**: Funciona para múltiplas unidades e organizações  
✅ **Rastreável**: Logs completos de uso e tentativas  
✅ **Revogável**: Admin pode invalidar a qualquer momento  

**Recomendação:** 🟢 **IMPLEMENTAR**

---

**Última atualização:** 30 de outubro de 2025
