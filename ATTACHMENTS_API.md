# Rotas de Attachments (Anexos)

Esta documentação descreve as novas rotas criadas para gerenciamento de anexos no sistema Equipe Ativa.

## Estrutura de Anexos

O sistema possui uma tabela `attachments` que armazena informações sobre todos os arquivos enviados. Os anexos podem ser associados a:

- **Usuários** (avatares)
- **Requerentes/Applicants** (avatares e documentos)
- **Demandas** (documentos)
- **Organizações** (avatares e documentos)

### Tipos de Anexos

- `AVATAR`: Foto de perfil
- `DOCUMENT`: Documento geral
- `IDENTITY`: Documento de identidade
- `ADDRESS`: Comprovante de endereço
- `INCOME`: Comprovante de renda
- `MEDICAL`: Documento médico
- `LEGAL`: Documento legal
- `OTHER`: Outros tipos

## Rotas Disponíveis

### 1. Upload de Avatar de Usuário
**POST** `/organizations/{organizationSlug}/users/{userId}/avatar`

- Faz upload do avatar de um usuário
- Apenas o próprio usuário pode alterar seu avatar
- Atualiza o campo `avatar_url` na tabela `users`
- Remove avatares anteriores automaticamente

### 2. Upload de Avatar de Requerente
**POST** `/organizations/{organizationSlug}/applicants/{applicantId}/avatar`

- Faz upload do avatar de um requerente
- Atualiza o campo `avatar_url` na tabela `applicants`
- Remove avatares anteriores automaticamente

### 3. Upload de Avatar de Organização
**POST** `/organizations/{organizationSlug}/avatar`

- Faz upload do avatar de uma organização
- Apenas ADMIN e MANAGER podem alterar
- Atualiza o campo `avatar_url` na tabela `organizations`
- Remove avatares anteriores automaticamente

### 4. Upload de Documento para Demanda
**POST** `/organizations/{organizationSlug}/demands/{demandId}/documents`

- Faz upload de documentos relacionados a uma demanda
- Suporta vários tipos de documento (DOCUMENT, IDENTITY, ADDRESS, etc.)
- Se for o primeiro documento, atualiza o campo `attachment` na tabela `demands`

### 5. Upload de Documento para Requerente
**POST** `/organizations/{organizationSlug}/applicants/{applicantId}/documents`

- Faz upload de documentos relacionados a um requerente
- Suporta vários tipos de documento
- Se for o primeiro documento, atualiza o campo `attachment` na tabela `applicants`
- Se for tipo AVATAR, atualiza também o campo `avatar_url`

### 6. Upload de Documento para Organização
**POST** `/organizations/{organizationSlug}/documents`

- Faz upload de documentos relacionados a uma organização
- Se for tipo AVATAR, atualiza o campo `avatar_url` da organização

### 7. Listar Anexos
**GET** `/organizations/{organizationSlug}/attachments`

**Query Parameters:**
- `demandId` (opcional): Filtrar por demanda específica
- `applicantId` (opcional): Filtrar por requerente específico
- `userId` (opcional): Filtrar por usuário específico
- `type` (opcional): Filtrar por tipo de anexo
- `page` (padrão: 1): Página para paginação
- `limit` (padrão: 20, max: 100): Itens por página

**Resposta:**
```json
{
  "attachments": [
    {
      "id": "uuid",
      "key": "chave-s3",
      "url": "url-publica",
      "originalName": "nome-original.pdf",
      "size": 1024,
      "mimeType": "application/pdf",
      "type": "DOCUMENT",
      "encrypted": false,
      "createdAt": "2023-01-01T00:00:00Z",
      "demandId": "uuid-ou-null",
      "applicantId": "uuid-ou-null",
      "userId": "uuid-ou-null",
      "uploadedBy": {
        "id": "uuid",
        "name": "Nome do Usuário",
        "email": "email@exemplo.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 8. Baixar Anexo
**GET** `/organizations/{organizationSlug}/attachments/{attachmentId}/download`

**Query Parameters:**
- `expiresIn` (opcional, padrão: 3600): Tempo de expiração da URL em segundos (min: 60, max: 86400)

**Resposta:**
```json
{
  "downloadUrl": "url-temporaria-s3",
  "originalName": "documento.pdf",
  "size": 1024,
  "mimeType": "application/pdf",
  "expiresIn": 3600
}
```

### 9. Deletar Anexo
**DELETE** `/organizations/{organizationSlug}/attachments/{attachmentId}`

- Apenas o usuário que fez o upload ou ADMIN/MANAGER podem deletar
- Remove o arquivo do S3
- Remove o registro do banco de dados
- Se for um avatar, limpa os campos `avatar_url` relacionados
- Se for um anexo principal de demanda/requerente, atualiza os campos `attachment`

## Validações e Restrições

### Tipos de Arquivo Permitidos

**Avatar:**
- image/jpeg, image/jpg, image/png, image/webp
- Tamanho máximo: 2MB

**Document:**
- PDF, Word, texto, CSV, imagens
- Tamanho máximo: 10MB

**Identity/Address/Income/Medical:**
- PDF e imagens
- Tamanho máximo: 5MB

**Legal:**
- PDF e documentos Word
- Tamanho máximo: 10MB

**Other:**
- Todos os tipos permitidos
- Tamanho máximo: 10MB

### Permissões

- **Upload de Avatar de Usuário**: Apenas o próprio usuário
- **Upload de Avatar de Organização**: ADMIN ou MANAGER
- **Upload de Documentos**: Qualquer membro da organização
- **Visualizar Anexos**: Qualquer membro da organização
- **Baixar Anexos**: Qualquer membro da organização
- **Deletar Anexos**: Usuário que fez upload ou ADMIN/MANAGER

## Integração com S3

Todos os arquivos são armazenados no Amazon S3 com a seguinte estrutura de pastas:

```
{tipo}/{organizationId}/{entityId?}/{timestamp}-{uuid}.{extensao}
```

Exemplos:
- `avatar/org-123/user-456/1234567890-uuid.jpg`
- `document/org-123/demand-789/1234567890-uuid.pdf`

## Campos Atualizados Automaticamente

As rotas também atualizam os campos de attachment nas tabelas principais:

### Tabela `users`
- `avatar_url`: Atualizado quando um avatar é enviado/removido

### Tabela `applicants`
- `avatar_url`: Atualizado quando um avatar é enviado/removido
- `attachment`: Atualizado quando o primeiro documento é enviado

### Tabela `demands`
- `attachment`: Atualizado quando o primeiro documento é enviado

### Tabela `organizations`
- `avatar_url`: Atualizado quando um avatar é enviado/removido

## Exemplos de Uso

### Upload de Avatar
```bash
curl -X POST \
  http://localhost:3333/organizations/minha-org/users/user-id/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@avatar.jpg"
```

### Upload de Documento para Demanda
```bash
curl -X POST \
  http://localhost:3333/organizations/minha-org/demands/demand-id/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@documento.pdf" \
  -F "type=IDENTITY"
```

### Listar Anexos de uma Demanda
```bash
curl -X GET \
  "http://localhost:3333/organizations/minha-org/attachments?demandId=demand-id&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Baixar Anexo
```bash
curl -X GET \
  "http://localhost:3333/organizations/minha-org/attachments/attachment-id/download?expiresIn=7200" \
  -H "Authorization: Bearer $TOKEN"
```

### Deletar Anexo
```bash
curl -X DELETE \
  http://localhost:3333/organizations/minha-org/attachments/attachment-id \
  -H "Authorization: Bearer $TOKEN"
```
