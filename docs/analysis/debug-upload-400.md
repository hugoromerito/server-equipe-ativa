# Debug: Upload de Avatar - Erro 400

## Problema
Requisições POST /users/{userId}/avatar retornam 400 em produção.

## Diagnóstico Realizado

### ✅ AWS S3 Connectivity
- Credenciais: Válidas
- Região: `sa-east-1` (São Paulo) - **CORRIGIDA**
- Bucket: `server-equipe-ativa-uploads` - Acessível
- Permissões: OK

### 📋 Configurações do Servidor
- Fastify Multipart configurado com:
  - `attachFieldsToBody: 'keyValues'`
  - `fileSize`: 10MB
  - `throwFileSizeLimit`: true

### 🔍 Logs Adicionados
- Rota de upload agora loga:
  - Content-Type recebido
  - Estado do multipart (`request.isMultipart()`)
  - Erros detalhados com stack trace
  
- Middleware de upload loga:
  - Estado do multipart antes de processar
  - Informações sobre arquivo não encontrado

## ⚠️ Possíveis Causas do Erro 400

### 1. **Nome do Campo Incorreto**
O campo do formulário DEVE ser `"file"`:

```javascript
// ❌ ERRADO
const formData = new FormData()
formData.append('avatar', file)  // Nome incorreto!

// ✅ CORRETO
const formData = new FormData()
formData.append('file', file)  // Nome deve ser 'file'
```

### 2. **Content-Type Incorreto**
O navegador deve enviar automaticamente:
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
```

**NÃO** defina manualmente o Content-Type no fetch/axios quando usar FormData:

```javascript
// ❌ ERRADO
fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data', // Isso quebra o boundary!
    'Authorization': `Bearer ${token}`
  },
  body: formData
})

// ✅ CORRETO
fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
    // NÃO definir Content-Type - deixar o navegador fazer
  },
  body: formData
})
```

### 3. **Arquivo Vazio ou Inválido**
Validações aplicadas:
- Tamanho máximo: 2MB para avatar
- Formatos aceitos: jpg, jpeg, png, webp
- Arquivo não pode estar vazio

### 4. **Tamanho Excedido**
Se o arquivo for maior que 2MB, o erro pode ocorrer antes de chegar no handler.

## 🧪 Como Testar Localmente

### Opção 1: cURL
```bash
# Fazer login primeiro
TOKEN=$(curl -s -X POST http://localhost:3333/sessions \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"suasenha"}' \
  | jq -r '.token')

# Pegar o user ID
USER_ID=$(curl -s -X GET http://localhost:3333/profile \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.user.id')

# Upload do avatar
curl -X POST "http://localhost:3333/users/$USER_ID/avatar" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./caminho/para/imagem.jpg"
```

### Opção 2: JavaScript (Frontend)
```javascript
// Pegar o arquivo do input
const fileInput = document.querySelector('input[type="file"]')
const file = fileInput.files[0]

// Criar FormData
const formData = new FormData()
formData.append('file', file)  // IMPORTANTE: nome deve ser 'file'

// Fazer upload
const response = await fetch(`https://api.equipeativa.com/users/${userId}/avatar`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
    // NÃO incluir Content-Type!
  },
  body: formData
})

if (!response.ok) {
  const error = await response.json()
  console.error('Erro no upload:', error)
}
```

### Opção 3: React com Axios
```typescript
import axios from 'axios'

async function uploadAvatar(userId: string, file: File, token: string) {
  const formData = new FormData()
  formData.append('file', file)  // Nome: 'file'
  
  try {
    const response = await axios.post(
      `https://api.equipeativa.com/users/${userId}/avatar`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`
          // axios define Content-Type automaticamente para FormData
        }
      }
    )
    
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Erro:', error.response?.data)
    }
    throw error
  }
}
```

## 📊 Verificar Logs em Produção

Após fazer uma requisição, verifique os logs do Heroku:

```bash
heroku logs --tail --app seu-app-name
```

Procure por:
- `"Recebendo requisição de upload de avatar"` - mostra Content-Type
- `"Tentando processar upload"` - mostra estado do multipart
- `"Nenhum arquivo foi encontrado"` - indica que `request.file()` retornou null
- `"Erro ao processar arquivo"` - mostra erro específico da validação

## 🔧 Próximos Passos

1. **Verificar como o frontend está enviando** - confirmar que usa nome de campo "file"
2. **Testar com cURL** - validar que a API funciona com requisição correta
3. **Analisar logs de produção** - ver exatamente qual erro está ocorrendo
4. **Verificar tamanho do arquivo** - pode estar excedendo 2MB

## 🐛 Se o Problema Persistir

Considere remover `attachFieldsToBody: 'keyValues'` do `src/server.ts` se não estiver sendo usado em outras rotas. Isso pode estar causando conflito com `request.file()`.

```typescript
// Em src/server.ts, linha 133
await app.register(fastifyMultipart, {
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: env.MAX_FILES_PER_UPLOAD,
    fieldSize: 1024 * 1024,
    headerPairs: 200,
  },
  // attachFieldsToBody: 'keyValues', // REMOVER esta linha
  throwFileSizeLimit: true,
})
```
