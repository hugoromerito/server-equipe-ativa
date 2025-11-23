# 🔌 Sistema WebSocket - Quick Start

## 🎯 O que é?

Sistema de notificações em tempo real para chamar pacientes quando o status da demanda mudar para "em andamento" (IN_PROGRESS).

## 🚀 Como Funciona

```
Médico/Profissional          API Backend          WebSocket          TV da Recepção
       |                          |                   |                      |
       |--Muda status para        |                   |                      |
       |  "IN_PROGRESS"---------->|                   |                      |
       |                          |                   |                      |
       |                          |--Emite evento---->|                      |
       |                          |  "patient-called" |                      |
       |                          |                   |                      |
       |                          |                   |--Broadcast---------->|
       |                          |                   |                      |
       |                          |                   |              EXIBE PACIENTE
```

## 📋 Dados Enviados

Quando uma demanda muda para IN_PROGRESS, o WebSocket envia:

```json
{
  "demandId": "uuid",
  "patientName": "Nome do Paciente",
  "memberName": "Dr. Nome do Médico",
  "jobTitle": "Médico Cardiologista",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "calledAt": "2025-10-22T14:30:00.000Z",
  "unitId": "uuid",
  "unitSlug": "unidade-centro",
  "organizationId": "uuid"
}
```

## 🧪 Testar Agora (5 minutos)

### 1. Inicie o servidor

```bash
npm run dev
```

Você deve ver:
```
✅ Servidor Socket.IO inicializado
🔌 WebSocket disponível em ws://localhost:3333
```

### 2. Abra o teste no navegador

```bash
# Abra o arquivo no navegador
open test-websocket.html
# ou
firefox test-websocket.html
```

### 3. Configure e conecte

1. Preencha:
   - Organization Slug: `minha-org`
   - Unit Slug: `unidade-centro`
2. Clique em **Conectar**
3. Veja o status mudar para "✅ Conectado"

### 4. Atualize uma demanda via API

```bash
curl -X PATCH http://localhost:3333/organizations/minha-org/units/unidade-centro/demands/{demandId} \
  -H "Authorization: Bearer {seu-token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}'
```

### 5. 🎉 Veja a mágica acontecer!

A tela mostrará:
- 🔔 PACIENTE CHAMADO
- Nome do paciente
- Profissional responsável
- Cargo do profissional

## 📚 Documentação Completa

- **[WEBSOCKET_GUIDE.md](./WEBSOCKET_GUIDE.md)** - Documentação detalhada
- **[WEBSOCKET_IMPLEMENTATION_SUMMARY.md](./WEBSOCKET_IMPLEMENTATION_SUMMARY.md)** - Resumo da implementação
- **[examples/README.md](./examples/README.md)** - Exemplos de código

## 🔗 Endpoints Úteis

```bash
# Verificar status do WebSocket
curl http://localhost:3333/websocket/info

# Health check
curl http://localhost:3333/health

# Documentação Swagger
open http://localhost:3333/docs
```

## 💻 Integrar no Frontend

### React/Next.js

1. Copie `examples/use-websocket.tsx` para `src/hooks/`
2. Copie `examples/tv-display-component.tsx` para `src/components/`
3. Use:

```tsx
import { TVDisplay } from '@/components/tv-display'

export default function TVPage() {
  return <TVDisplay 
    organizationSlug="minha-org" 
    unitSlug="unidade-centro" 
  />
}
```

### Vanilla JS

Use `test-websocket.html` como base.

## 🐛 Problemas?

### WebSocket não conecta

1. Verifique se o servidor está rodando: `curl http://localhost:3333/health`
2. Verifique CORS no console do navegador
3. Teste com `curl http://localhost:3333/websocket/info`

### Não recebe eventos

1. Confirme que entrou na sala: veja logs no servidor
2. Verifique se a demanda está na unidade correta
3. Confirme que o status mudou para `IN_PROGRESS`

## 📦 Estrutura de Arquivos

```
src/
├── lib/
│   └── socket-server.ts          # Servidor Socket.IO
├── types/
│   └── socket.ts                 # Tipos TypeScript
└── http/
    └── routes/
        ├── demands/
        │   └── update-demand.ts  # Emite eventos
        └── websocket/
            └── websocket-info.ts # Endpoint de info

examples/                         # Exemplos frontend
├── use-websocket.tsx            # Hook React
├── tv-display-component.tsx     # Componente TV
└── websocket-types.ts           # Tipos exportáveis

test-websocket.html              # Teste interativo
test-websocket.sh                # Script de testes
WEBSOCKET_GUIDE.md               # Documentação completa
```

## ✅ Checklist

- [x] WebSocket instalado e configurado
- [x] Eventos tipados (TypeScript)
- [x] Sistema de salas (org/unit)
- [x] Busca dados do paciente + profissional
- [x] Endpoint de monitoramento
- [x] Documentação completa
- [x] Exemplos de código
- [x] Ferramenta de teste
- [ ] Frontend implementado (próximo passo)

## 🤝 Suporte

Dúvidas? Consulte:
1. `WEBSOCKET_GUIDE.md` - Guia completo
2. http://localhost:3333/docs - API Swagger
3. Exemplos em `examples/`

---

**Pronto para produção!** 🚀
