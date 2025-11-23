# Teste das Rotas de Attachments

Este arquivo contém exemplos de como testar as novas rotas de attachments.

## Configuração

Antes de testar, certifique-se de ter:

1. Um token JWT válido
2. Uma organização criada
3. Usuários, requerentes ou demandas criados (dependendo do teste)

```bash
# Defina o token JWT
export TOKEN="seu_jwt_token_aqui"
export ORG_SLUG="sua-organizacao"
export BASE_URL="http://localhost:3333"
```

## Testes de Upload

### 1. Upload de Avatar de Usuário

```bash
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/users/user-uuid/avatar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@tests/fixtures/avatar.jpg"
```

### 2. Upload de Avatar de Requerente

```bash
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/applicants/applicant-uuid/avatar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@tests/fixtures/avatar.jpg"
```

### 3. Upload de Avatar de Organização

```bash
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/avatar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@tests/fixtures/logo.png"
```

### 4. Upload de Documento para Demanda

```bash
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/demands/demand-uuid/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@tests/fixtures/documento.pdf" \
  -F "type=IDENTITY"
```

### 5. Upload de Documento para Requerente

```bash
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/applicants/applicant-uuid/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@tests/fixtures/comprovante.pdf" \
  -F "type=ADDRESS"
```

### 6. Upload de Documento para Organização

```bash
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@tests/fixtures/contrato.pdf" \
  -F "type=LEGAL"
```

## Testes de Listagem

### 1. Listar Todos os Anexos da Organização

```bash
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 2. Listar Anexos de uma Demanda Específica

```bash
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments?demandId=demand-uuid" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3. Listar Anexos de um Requerente Específico

```bash
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments?applicantId=applicant-uuid" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 4. Listar Apenas Avatares

```bash
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments?type=AVATAR" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 5. Listar com Paginação

```bash
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments?page=2&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Testes de Download

### 1. Baixar Anexo com Tempo de Expiração Padrão (1 hora)

```bash
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments/attachment-uuid/download" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 2. Baixar Anexo com Tempo de Expiração Personalizado (2 horas)

```bash
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments/attachment-uuid/download?expiresIn=7200" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Testes de Exclusão

### 1. Deletar Anexo

```bash
curl -X DELETE \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments/attachment-uuid" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Testes de Validação

### 1. Teste de Arquivo Muito Grande

```bash
# Crie um arquivo maior que o limite (10MB para documentos)
dd if=/dev/zero of=arquivo_grande.pdf bs=1M count=15

curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@arquivo_grande.pdf"

# Deve retornar erro 400
```

### 2. Teste de Tipo de Arquivo Não Permitido

```bash
# Tente enviar um arquivo .exe como avatar
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/avatar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@programa.exe"

# Deve retornar erro 400
```

### 3. Teste de Permissão (usuário sem autorização)

```bash
# Use um token de um usuário sem permissão de ADMIN/MANAGER
export TOKEN_GUEST="token_de_usuario_guest"

curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/avatar" \
  -H "Authorization: Bearer ${TOKEN_GUEST}" \
  -F "file=@logo.png"

# Deve retornar erro 400 ou 403
```

## Verificação de Integridade

### 1. Verificar se o Campo avatar_url foi Atualizado

Após upload de avatar, verifique se o campo foi atualizado:

```bash
# Para usuário
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/users/user-uuid" \
  -H "Authorization: Bearer ${TOKEN}"

# Para requerente
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/applicants/applicant-uuid" \
  -H "Authorization: Bearer ${TOKEN}"

# Para organização
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 2. Verificar se o Campo attachment foi Atualizado

Após upload do primeiro documento:

```bash
# Para demanda
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/demands/demand-uuid" \
  -H "Authorization: Bearer ${TOKEN}"

# Para requerente
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/applicants/applicant-uuid" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Testes de Cenários Complexos

### 1. Upload Múltiplo e Substituição de Avatar

```bash
# 1. Faça upload de um avatar
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/users/user-uuid/avatar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@avatar1.jpg"

# 2. Faça upload de outro avatar (deve substituir o anterior)
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/users/user-uuid/avatar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@avatar2.jpg"

# 3. Verifique se apenas um avatar existe
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments?userId=user-uuid&type=AVATAR" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 2. Upload de Múltiplos Documentos para uma Demanda

```bash
# Upload de documento de identidade
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/demands/demand-uuid/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@identidade.pdf" \
  -F "type=IDENTITY"

# Upload de comprovante de endereço
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/demands/demand-uuid/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@endereco.pdf" \
  -F "type=ADDRESS"

# Upload de comprovante de renda
curl -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/demands/demand-uuid/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@renda.pdf" \
  -F "type=INCOME"

# Verificar todos os documentos
curl -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments?demandId=demand-uuid" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Scripts de Automação

### Script de Teste Completo (Bash)

```bash
#!/bin/bash

# Configuração
TOKEN="seu_token_aqui"
ORG_SLUG="sua-org"
BASE_URL="http://localhost:3333"

echo "=== Testando Rotas de Attachments ==="

# Teste 1: Upload de avatar de usuário
echo "1. Testando upload de avatar de usuário..."
response=$(curl -s -w "%{http_code}" -X POST \
  "${BASE_URL}/organizations/${ORG_SLUG}/users/user-uuid/avatar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@avatar.jpg")

if [[ "${response: -3}" == "201" ]]; then
  echo "✅ Upload de avatar de usuário: SUCESSO"
else
  echo "❌ Upload de avatar de usuário: FALHOU (${response: -3})"
fi

# Teste 2: Listar anexos
echo "2. Testando listagem de anexos..."
response=$(curl -s -w "%{http_code}" -X GET \
  "${BASE_URL}/organizations/${ORG_SLUG}/attachments" \
  -H "Authorization: Bearer ${TOKEN}")

if [[ "${response: -3}" == "200" ]]; then
  echo "✅ Listagem de anexos: SUCESSO"
else
  echo "❌ Listagem de anexos: FALHOU (${response: -3})"
fi

echo "=== Testes Concluídos ==="
```

## Estrutura de Resposta Esperada

### Upload (201 Created)

```json
{
  "attachmentId": "uuid-do-anexo",
  "url": "https://bucket.s3.region.amazonaws.com/path/file.ext",
  "originalName": "arquivo-original.pdf",
  "type": "DOCUMENT"
}
```

### Listagem (200 OK)

```json
{
  "attachments": [
    {
      "id": "uuid",
      "key": "path/no/s3",
      "url": "url-publica",
      "originalName": "arquivo.pdf",
      "size": 1024,
      "mimeType": "application/pdf",
      "type": "DOCUMENT",
      "encrypted": false,
      "createdAt": "2023-01-01T00:00:00Z",
      "demandId": null,
      "applicantId": "uuid",
      "userId": null,
      "uploadedBy": {
        "id": "uuid",
        "name": "Nome",
        "email": "email@exemplo.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Download (200 OK)

```json
{
  "downloadUrl": "https://bucket.s3.region.amazonaws.com/path/file.ext?signed-params",
  "originalName": "arquivo.pdf",
  "size": 1024,
  "mimeType": "application/pdf",
  "expiresIn": 3600
}
```

### Exclusão (204 No Content)

Resposta vazia com status 204.
