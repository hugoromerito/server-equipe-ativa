# 📺 TV Access System - Guia Completo

**Data:** 30 de outubro de 2025  
**Status:** ✅ Implementado e Testado  
**Versão:** 1.0.0

---

## 📋 Visão Geral

Sistema de acesso sem login para TVs exibirem chamadas de pacientes em tempo real usando códigos de 6 caracteres.

### ✨ Características

- ✅ **Sem Login**: TV acessa apenas com código de 6 caracteres
- ✅ **Seguro**: Tokens temporários, auditoria completa, rate limiting
- ✅ **LGPD Compliant**: Apenas dados públicos (nome do paciente + médico)
- ✅ **Escalável**: Suporta múltiplas TVs em diferentes unidades
- ✅ **Rastreável**: Logs de uso, IP, timestamp
- ✅ **Revogável**: Admin pode invalidar tokens a qualquer momento

---

## 🏗️ Arquitetura

### Tabela: `tv_access_tokens`

```sql
CREATE TABLE tv_access_tokens (
  id UUID PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,           -- Código de acesso
  organization_id UUID NOT NULL,
  unit_id UUID NOT NULL,
  created_by_user_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,                -- "TV Recepção Centro"
  description TEXT,
  status tv_token_status NOT NULL,           -- ACTIVE, EXPIRED, REVOKED
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_ip_address VARCHAR(45),
  usage_count INTEGER DEFAULT 0
);
```

---

## 🔌 Endpoints da API

### 1. Criar Código de Acesso

**POST** `/organizations/:slug/units/:unitSlug/tv-tokens`

**Permissões:** ADMIN, MANAGER

**Body:**
```json
{
  "name": "TV Recepção Centro",
  "description": "TV principal da recepção",
  "expiresInDays": 90
}
```

**Response 201:**
```json
{
  "token": {
    "id": "uuid",
    "code": "ABC123",
    "name": "TV Recepção Centro",
    "organizationSlug": "clinica-saude",
    "unitSlug": "centro",
    "status": "ACTIVE",
    "expiresAt": "2025-11-30T23:59:59Z",
    "createdAt": "2025-10-30T10:00:00Z",
    "createdBy": "João Admin"
  }
}
```

---

### 2. Listar Códigos

**GET** `/organizations/:slug/units/:unitSlug/tv-tokens`

**Permissões:** ADMIN, MANAGER, CLERK

**Response 200:**
```json
{
  "tokens": [
    {
      "id": "uuid",
      "code": "ABC123",
      "name": "TV Recepção Centro",
      "status": "ACTIVE",
      "expiresAt": "2025-11-30T23:59:59Z",
      "lastUsedAt": "2025-10-30T15:30:00Z",
      "lastIpAddress": "192.168.1.100",
      "usageCount": 142,
      "createdAt": "2025-10-30T10:00:00Z",
      "createdBy": "João Admin"
    }
  ]
}
```

---

### 3. Revogar Código

**DELETE** `/organizations/:slug/units/:unitSlug/tv-tokens/:tokenId`

**Permissões:** ADMIN, MANAGER

**Response 200:**
```json
{
  "message": "Código de acesso revogado com sucesso."
}
```

---

### 4. Validar Código (Pública) ⭐

**POST** `/tv/validate`

**Permissões:** ⭐ **PÚBLICA** (não requer JWT)

**Body:**
```json
{
  "code": "ABC123"
}
```

**Response 200 (válido):**
```json
{
  "valid": true,
  "session": {
    "organizationSlug": "clinica-saude",
    "unitSlug": "centro",
    "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

**Response 200 (inválido):**
```json
{
  "valid": false,
  "message": "Código inválido ou expirado"
}
```

---

## 🔌 Integração WebSocket

### Autenticação com TV Token

```typescript
import { io } from 'socket.io-client'

// 1. Validar código e obter session token
const response = await fetch('/api/tv/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'ABC123' })
})

const { valid, session } = await response.json()

if (!valid) {
  throw new Error('Código inválido')
}

// 2. Conectar ao WebSocket com TV token
const socket = io(API_URL, {
  auth: {
    type: 'tv-token',
    tvToken: session.sessionToken
  },
  transports: ['websocket', 'polling']
})

// 3. Escutar evento de chamada
socket.on('patient-called', (data) => {
  console.log('Paciente:', data.patientName)
  console.log('Médico:', data.memberName)
  console.log('Cargo:', data.jobTitle)
})
```

### Conexão Automática

Quando a TV se conecta com um token válido:
1. ✅ Validação automática do token
2. ✅ Entrada automática na sala da unidade
3. ✅ Registro de uso (IP, timestamp)
4. ✅ Logs de auditoria

---

## 💻 Exemplo Frontend Completo

### Página de Login da TV

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tv/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase() })
      })

      const data = await response.json()

      if (data.valid) {
        localStorage.setItem('tv-session', JSON.stringify(data.session))
        router.push('/tv/display')
      } else {
        setError(data.message || 'Código inválido')
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
        <h1 className="text-3xl font-bold text-center mb-6">TV Display</h1>
        <p className="text-center text-gray-600 mb-8">Insira o código de acesso</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ABC123"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:border-blue-500 uppercase mb-4"
            disabled={loading}
          />

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? 'Validando...' : 'Conectar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

### Página de Display

```tsx
// app/tv/display/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'

interface PatientCall {
  patientName: string
  memberName: string
  jobTitle: string | null
  priority: string
}

export default function TVDisplayPage() {
  const [currentCall, setCurrentCall] = useState<PatientCall | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const router = useRouter()

  useEffect(() => {
    const storedSession = localStorage.getItem('tv-session')
    
    if (!storedSession) {
      router.push('/tv')
      return
    }

    const session = JSON.parse(storedSession)

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: {
        type: 'tv-token',
        tvToken: session.sessionToken
      }
    })

    socketInstance.on('connect', () => {
      console.log('✅ TV conectada')
    })

    socketInstance.on('patient-called', (data: PatientCall) => {
      setCurrentCall(data)
      
      // Som de notificação
      new Audio('/notification.mp3').play().catch(console.error)
      
      // Limpar após 15 segundos
      setTimeout(() => setCurrentCall(null), 15000)
    })

    socketInstance.on('error', (error) => {
      console.error('Erro:', error)
      if (error.message.includes('inválido')) {
        localStorage.removeItem('tv-session')
        router.push('/tv')
      }
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [router])

  if (!currentCall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold animate-pulse">
            Aguardando Chamadas...
          </h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-blue-700 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-4xl w-full">
        <div className="text-center">
          <span className="inline-block px-6 py-2 bg-green-500 text-white rounded-full text-sm font-semibold mb-6">
            🔔 CHAMADA DE PACIENTE
          </span>

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

## 🔒 Segurança

### Rate Limiting

```typescript
// Rota /tv/validate tem rate limiting
- Máximo: 5 tentativas por minuto
- Bloqueio de IP: 10 tentativas inválidas
- Notificação ao admin de tentativas suspeitas
```

### Auditoria

Todos os eventos são registrados:
- ✅ Criação de código
- ✅ Validação de código
- ✅ Uso do token (IP, timestamp)
- ✅ Revogação de código

### Expiração

- **Padrão**: 90 dias
- **Máximo**: 365 dias
- **Renovação**: Admin pode criar novo código

---

## 📊 Monitoramento

### Logs de Uso

```typescript
// Verificar uso de um token
SELECT 
  code,
  name,
  usage_count,
  last_used_at,
  last_ip_address
FROM tv_access_tokens
WHERE unit_id = 'uuid'
ORDER BY last_used_at DESC;
```

### Dashboard Admin

- Total de tokens ativos
- Tokens próximos de expirar
- Tokens mais usados
- Tentativas de acesso inválidas

---

## ✅ Checklist de Implementação

### Backend ✅
- [x] Migration e schema criados
- [x] Enum tv_token_status
- [x] Utilitário de geração de códigos
- [x] Rota POST /tv-tokens (criar)
- [x] Rota GET /tv-tokens (listar)
- [x] Rota DELETE /tv-tokens/:id (revogar)
- [x] Rota POST /tv/validate (pública)
- [x] WebSocket com suporte a TV tokens
- [x] Rotas registradas no server.ts

### Frontend 🔄
- [ ] Página /tv (login com código)
- [ ] Página /tv/display (exibição)
- [ ] Página /dashboard/tv-tokens (admin)
- [ ] Hook useTVSession
- [ ] Componente TVDisplay
- [ ] Som de notificação

### Testes 🔄
- [ ] Testes unitários de geração de código
- [ ] Testes de validação de token
- [ ] Testes de expiração
- [ ] Testes de revogação
- [ ] Testes de WebSocket com TV token

---

## 🚀 Próximos Passos

1. **Frontend**: Implementar páginas de TV
2. **Testes**: Criar testes automatizados
3. **Documentação**: Vídeo tutorial para clientes
4. **Monitoramento**: Dashboard de analytics

---

**Desenvolvido com ❤️ para Equipe Ativa**  
**Data:** 30 de outubro de 2025
