# Guia de Aplicação do Tratamento de Erro

## Melhorias Implementadas

### 1. Sistema de Classes de Erro
- `BadRequestError` - 400: Dados inválidos
- `UnauthorizedError` - 401: Autenticação necessária  
- `ForbiddenError` - 403: Sem permissão
- `NotFoundError` - 404: Recurso não encontrado
- `ConflictError` - 409: Conflito de dados
- `InternalServerError` - 500: Erro interno

### 2. Schemas de Resposta Padronizados
- `createOperationResponses` - Para operações POST (criação)
- `getOperationResponses` - Para operações GET (consulta)
- `updateOperationResponses` - Para operações PUT/PATCH (atualização)
- `deleteOperationResponses` - Para operações DELETE
- `publicGetOperationResponses` - Para consultas públicas

### 3. Padrões de Implementação

#### Para Rotas de Criação (POST):
```typescript
import { createOperationResponses } from '../_errors/response-schemas.ts'
import { BadRequestError, ConflictError, InternalServerError } from '../_errors/...'

// No schema:
response: createOperationResponses(
  z.object({
    id: z.string().uuid(),
    // outros campos...
  })
)

// Na implementação:
try {
  // verificações de negócio
  if (conflictCondition) {
    throw new ConflictError('Mensagem específica')
  }
  
  // operação principal
  const result = await db.insert(...)
  
  return reply.status(201).send({ id: result.id })
} catch (error) {
  if (error instanceof ConflictError || error instanceof BadRequestError) {
    throw error
  }
  throw new InternalServerError('Erro interno ao criar recurso.')
}
```

#### Para Rotas de Consulta (GET):
```typescript
import { getOperationResponses } from '../_errors/response-schemas.ts'
import { NotFoundError } from '../_errors/...'

// No schema:
response: getOperationResponses(
  z.object({
    data: z.array(...) // ou objeto individual
  })
)

// Na implementação:
const result = await db.select(...)

if (!result[0]) {
  throw new NotFoundError('Recurso não encontrado.')
}

return reply.status(200).send({ data: result })
```

#### Para Rotas de Atualização (PUT/PATCH):
```typescript
import { updateOperationResponses } from '../_errors/response-schemas.ts'

// Similar ao GET, mas usando updateOperationResponses
```

#### Para Rotas de Exclusão (DELETE):
```typescript
import { deleteOperationResponses } from '../_errors/response-schemas.ts'

// No schema:
response: deleteOperationResponses()

// Na implementação:
const result = await db.delete(...)

if (!result.length) {
  throw new NotFoundError('Recurso não encontrado.')
}

return reply.status(204).send()
```

### 4. Validações de Entrada
- Usar validações Zod mais específicas:
  - `z.string().min(1, 'Campo obrigatório')`
  - `z.string().email('E-mail deve ter formato válido')`
  - `z.string().uuid('ID deve ser um UUID válido')`

### 5. Códigos de Status HTTP Corretos
- 200: Sucesso em consultas
- 201: Sucesso em criações
- 204: Sucesso sem conteúdo (exclusões)
- 400: Dados de entrada inválidos
- 401: Não autenticado
- 403: Sem permissão
- 404: Recurso não encontrado
- 409: Conflito (dados duplicados)
- 500: Erro interno do servidor

### 6. Estrutura de Resposta de Erro Padronizada
```json
{
  "error": "Tipo do Erro",
  "code": "CODIGO_ERRO",
  "message": "Mensagem descritiva em português"
}
```

## Rotas Já Corrigidas
- [x] Todas as rotas de invites
- [x] create-organization.ts
- [x] authenticate-with-password.ts
- [x] get-profile.ts

## Próximas Rotas a Corrigir
- [ ] Todas as rotas de auth restantes
- [ ] Rotas de applicants
- [ ] Rotas de demands
- [ ] Rotas de attachments
- [ ] Rotas de members
- [ ] Rotas de organizations restantes
- [ ] Rotas de units
- [ ] Rotas de users

## Comandos para Testar
```bash
# Testar rotas específicas
npm test tests/routes/auth.test.ts
npm test tests/routes/organizations.test.ts
npm test tests/routes/applicants.test.ts

# Testar todas as rotas
npm test
```
