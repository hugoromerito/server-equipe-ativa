# 🔌 Sistema de WebSocket - Chamada de Pacientes em Tempo Real

## 📋 Visão Geral

Sistema completo de WebSocket usando **Socket.IO** para atualizações em tempo real quando o status de uma demanda mudar para "em andamento" (IN_PROGRESS). Quando o médico/profissional altera o status, o paciente é automaticamente chamado na TV da recepção.

## 🏗️ Arquitetura

### Componentes Principais

1. **Socket Server** (`src/lib/socket-server.ts`)
   - Inicialização do servidor Socket.IO
   - Gerenciamento de salas por organização e unidade
   - Emissão de eventos tipados
   - Handlers de conexão/desconexão

2. **Types** (`src/types/socket.ts`)
   - Interfaces TypeScript para eventos
   - Tipos de dados para payloads
   - Funções utilitárias para nomes de salas

3. **Integration** (`src/http/routes/demands/update-demand.ts`)
   - Emissão de evento quando status = IN_PROGRESS
   - Busca de dados do paciente (applicant) e profissional (member)
   - Inclusão de job title do profissional

4. **Info Endpoint** (`src/http/routes/websocket/websocket-info.ts`)
   - Rota para monitorar status do WebSocket
   - Lista de clientes conectados
   - Salas ativas

## 🚀 Como Funciona

### Fluxo Completo

```
1. Profissional com job-title altera status da demanda para "IN_PROGRESS"
2. Backend emite evento via WebSocket para a sala da unidade
3. TV da recepção (conectada à sala) recebe o evento
4. Nome do paciente + profissional + cargo aparecem na TV
```

### Diagrama de Sequência

```
Profissional         API Backend         Socket.IO          TV Display
    |                     |                  |                   |
    |--PATCH /demands     |                  |                   |
    |  status: IN_PROGRESS|                  |                   |
    |                     |                  |                   |
    |                     |--emit('patient-called')              |
    |                     |   to room: org:slug:unit:slug        |
    |                     |                  |                   |
    |                     |                  |---broadcast------>|
    |                     |                  |                   |
    |                     |                  |         Exibe dados do paciente
    |                     |                  |         + profissional
```

## 📡 Eventos WebSocket

### Eventos do Servidor → Cliente

#### `patient-called`

Emitido quando uma demanda muda para status `IN_PROGRESS`.

**Payload:**
```typescript
{
  demandId: string          // UUID da demanda
  patientName: string       // Nome do paciente (applicant)
  memberName: string        // Nome do profissional responsável
  jobTitle: string | null   // Cargo/função do profissional
  status: string            // Status da demanda (IN_PROGRESS)
  priority: string          // Prioridade (LOW, MEDIUM, HIGH, URGENT)
  calledAt: Date            // Data/hora da chamada
  unitId: string            // UUID da unidade
  unitSlug: string          // Slug da unidade
  organizationId: string    // UUID da organização
}
```

**Exemplo:**
```json
{
  "demandId": "123e4567-e89b-12d3-a456-426614174000",
  "patientName": "João Silva",
  "memberName": "Dr. Maria Santos",
  "jobTitle": "Médica Cardiologista",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "calledAt": "2025-10-22T14:30:00.000Z",
  "unitId": "abc12345-...",
  "unitSlug": "unidade-centro",
  "organizationId": "def67890-..."
}
```

#### `connected`

Confirmação de conexão enviada imediatamente após cliente conectar.

**Payload:**
```typescript
{
  message: string
  timestamp: Date
}
```

### Eventos do Cliente → Servidor

#### `join-organization`

Cliente entra em uma sala de organização para receber todos os eventos.

**Parâmetro:** `organizationSlug: string`

**Exemplo:**
```javascript
socket.emit('join-organization', 'minha-organizacao')
```

#### `join-unit`

Cliente entra em uma sala de unidade específica.

**Parâmetro:**
```typescript
{
  organizationSlug: string
  unitSlug: string
}
```

**Exemplo:**
```javascript
socket.emit('join-unit', {
  organizationSlug: 'minha-organizacao',
  unitSlug: 'unidade-centro'
})
```

#### `leave-organization` / `leave-unit`

Cliente sai de uma sala.

## 🔧 Integração Frontend

### Instalação

```bash
npm install socket.io-client
```

### Exemplo Básico (React)

```typescript
import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { PatientCalledData } from './types/socket'

export function useTVDisplay(organizationSlug: string, unitSlug: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [currentPatient, setCurrentPatient] = useState<PatientCalledData | null>(null)

  useEffect(() => {
    // Conectar ao servidor
    const socketInstance = io('http://localhost:3333', {
      transports: ['websocket', 'polling'],
    })

    socketInstance.on('connect', () => {
      console.log('✅ Conectado ao WebSocket')
      
      // Entrar na sala da unidade
      socketInstance.emit('join-unit', {
        organizationSlug,
        unitSlug,
      })
    })

    socketInstance.on('connected', (data) => {
      console.log('Confirmação:', data.message)
    })

    socketInstance.on('patient-called', (data: PatientCalledData) => {
      console.log('🔔 Paciente chamado:', data)
      setCurrentPatient(data)
      
      // Reproduzir som de chamada
      playCallSound()
      
      // Limpar após 10 segundos
      setTimeout(() => setCurrentPatient(null), 10000)
    })

    socketInstance.on('disconnect', () => {
      console.log('❌ Desconectado do WebSocket')
    })

    setSocket(socketInstance)

    // Cleanup
    return () => {
      socketInstance.emit('leave-unit', { organizationSlug, unitSlug })
      socketInstance.disconnect()
    }
  }, [organizationSlug, unitSlug])

  return { socket, currentPatient }
}
```

### Componente de TV Display

```typescript
import { useTVDisplay } from './hooks/useTVDisplay'

export function TVDisplay() {
  const { currentPatient } = useTVDisplay('minha-org', 'unidade-centro')

  if (!currentPatient) {
    return (
      <div className="tv-display standby">
        <h1>Aguardando chamadas...</h1>
      </div>
    )
  }

  return (
    <div className="tv-display active">
      <div className="patient-info">
        <h1>Paciente: {currentPatient.patientName}</h1>
        <h2>
          Profissional: {currentPatient.memberName}
          {currentPatient.jobTitle && ` - ${currentPatient.jobTitle}`}
        </h2>
        <p className={`priority-${currentPatient.priority.toLowerCase()}`}>
          Prioridade: {currentPatient.priority}
        </p>
      </div>
    </div>
  )
}
```

## 🧪 Testando o WebSocket

### 1. Verificar Status do Servidor

```bash
curl http://localhost:3333/websocket/info
```

**Resposta:**
```json
{
  "active": true,
  "connectedClients": 3,
  "rooms": [
    "org:minha-org",
    "org:minha-org:unit:unidade-centro"
  ],
  "timestamp": "2025-10-22T14:30:00.000Z"
}
```

### 2. Testar Conexão com Cliente HTML

Crie um arquivo `test-websocket.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Teste WebSocket</title>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
</head>
<body>
  <h1>Teste WebSocket - TV Display</h1>
  <div id="status">Conectando...</div>
  <div id="patient-info"></div>

  <script>
    const socket = io('http://localhost:3333')

    socket.on('connect', () => {
      document.getElementById('status').textContent = '✅ Conectado'
      
      // Entrar na sala
      socket.emit('join-unit', {
        organizationSlug: 'minha-org',
        unitSlug: 'unidade-centro'
      })
    })

    socket.on('patient-called', (data) => {
      console.log('Paciente chamado:', data)
      
      const html = `
        <h2>🔔 CHAMADA DE PACIENTE</h2>
        <p><strong>Paciente:</strong> ${data.patientName}</p>
        <p><strong>Profissional:</strong> ${data.memberName}</p>
        <p><strong>Cargo:</strong> ${data.jobTitle || 'N/A'}</p>
        <p><strong>Prioridade:</strong> ${data.priority}</p>
      `
      document.getElementById('patient-info').innerHTML = html
    })

    socket.on('disconnect', () => {
      document.getElementById('status').textContent = '❌ Desconectado'
    })
  </script>
</body>
</html>
```

### 3. Testar Emissão de Evento

Atualize uma demanda para status `IN_PROGRESS`:

```bash
curl -X PATCH http://localhost:3333/organizations/minha-org/units/unidade-centro/demands/{demandId} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

## 📊 Estrutura de Salas

O Socket.IO organiza conexões em **salas** (rooms):

### Nomenclatura

- **Organização:** `org:{organizationSlug}`
- **Unidade:** `org:{organizationSlug}:unit:{unitSlug}`

### Exemplo

- Organização "Clínica Saúde" (`clinica-saude`)
  - Sala: `org:clinica-saude`
  
- Unidade "Centro" da Clínica Saúde
  - Sala: `org:clinica-saude:unit:centro`

### Vantagens

- ✅ Isolamento por organização/unidade
- ✅ Escalabilidade
- ✅ Broadcast seletivo
- ✅ Múltiplas TVs em diferentes unidades

## 🔐 Segurança

### CORS

O servidor Socket.IO está configurado com as mesmas regras CORS do servidor HTTP:

- **Desenvolvimento:** localhost:3000, localhost:5173
- **Produção:** Domínios Vercel (*.vercel.app)
- **Custom:** Variável `ALLOWED_ORIGINS`

### Autenticação (Opcional)

Para adicionar autenticação JWT ao WebSocket:

```typescript
// src/lib/socket-server.ts
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  
  if (!token) {
    return next(new Error('Token não fornecido'))
  }

  // Validar token JWT
  try {
    const decoded = verifyJWT(token)
    socket.data.userId = decoded.sub
    next()
  } catch (error) {
    next(new Error('Token inválido'))
  }
})
```

**Cliente:**
```typescript
const socket = io('http://localhost:3333', {
  auth: {
    token: 'seu-jwt-token'
  }
})
```

## 📈 Monitoramento

### Logs

O sistema registra logs detalhados:

```
INFO: Cliente conectado ao WebSocket { socketId: 'abc123', transport: 'websocket' }
INFO: Cliente entrou na sala da unidade { room: 'org:clinica:unit:centro' }
DEBUG: Evento emitido para unidade { event: 'patient-called' }
INFO: Cliente desconectado { reason: 'client namespace disconnect' }
```

### Métricas

Endpoint `/websocket/info` fornece:

- Total de clientes conectados
- Lista de salas ativas
- Status do servidor

## 🐛 Troubleshooting

### Problema: Cliente não recebe eventos

**Soluções:**
1. Verificar se entrou na sala correta: `socket.emit('join-unit', {...})`
2. Verificar CORS no navegador (DevTools → Console)
3. Testar com `curl http://localhost:3333/websocket/info`

### Problema: "Socket.IO não inicializado"

**Causa:** Servidor não foi iniciado corretamente

**Solução:**
```bash
npm run dev
# Verificar log: "✅ Servidor Socket.IO inicializado"
```

### Problema: Reconexão infinita

**Causa:** CORS bloqueando conexão

**Solução:** Adicionar origin em `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=http://localhost:3000,https://app.exemplo.com
```

## 🚀 Deploy

### Variáveis de Ambiente

```env
# .env
NODE_ENV=production
ALLOWED_ORIGINS=https://app.exemplo.com,https://tv.exemplo.com
```

### Heroku / Railway

Socket.IO funciona automaticamente com transports `websocket` e `polling` (fallback).

### Vercel

⚠️ **Limitação:** Vercel Serverless Functions não suportam WebSocket persistente.

**Alternativas:**
- Deploy backend em Heroku/Railway/Render
- Usar Vercel apenas para frontend
- Usar Pusher/Ably como alternativa gerenciada

## 📚 Referências

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Socket.IO Client (React)](https://socket.io/how-to/use-with-react)
- [TypeScript + Socket.IO](https://socket.io/docs/v4/typescript/)

## ✅ Checklist de Implementação

- [x] Instalação do Socket.IO
- [x] Tipos TypeScript para eventos
- [x] Servidor Socket.IO configurado
- [x] Integração com Fastify
- [x] Emissão de evento em update-demand
- [x] Endpoint de monitoramento
- [x] Sistema de salas (org/unit)
- [x] Busca de dados do paciente e profissional
- [x] Inclusão de job title
- [x] CORS configurado
- [x] Logs estruturados
- [x] Graceful shutdown
- [ ] Autenticação JWT (opcional)
- [ ] Rate limiting (opcional)
- [ ] Testes automatizados (próximo passo)

## 🎯 Próximos Passos

1. **Frontend:** Implementar hook `useWebSocket` e componente `TVDisplay`
2. **Autenticação:** Adicionar JWT ao handshake do WebSocket
3. **Notificações:** Adicionar sons e animações na TV
4. **Analytics:** Rastrear quantas chamadas foram feitas
5. **Histórico:** Salvar histórico de chamadas no banco
6. **Multi-idioma:** Suporte a português/inglês/espanhol

---

**Desenvolvido com ❤️ para Equipe Ativa**
