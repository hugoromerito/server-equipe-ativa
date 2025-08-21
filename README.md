# 🚀 Equipe Ativa API

Uma API REST robusta para gerenciamento de equipes ativas, desenvolvida com **TypeScript**, **Fastify** e **PostgreSQL**. Este sistema oferece funcionalidades completas para gestão de organizações, unidades, membros, demandas e solicitações.

## ✨ Funcionalidades

### 🔐 Autenticação & Autorização
- Sistema de autenticação JWT
- Recuperação de senha
- Gestão de perfis de usuário
- Sistema de permissões baseado em CASL

### 🏢 Gestão Organizacional
- **Organizações**: Criação, atualização e gerenciamento
- **Unidades**: Estrutura hierárquica dentro das organizações
- **Membros**: Convites, aceite/rejeição e gerenciamento de membros
- **Permissões**: Sistema granular de controle de acesso

### 📋 Sistema de Demandas
- Criação e atualização de demandas
- Classificação automática de demandas com IA (OpenAI)
- Vinculação de solicitantes às demandas
- Histórico completo de demandas

### 👥 Gestão de Solicitantes
- Cadastro e validação de solicitantes
- Verificação de CPF
- Consulta de demandas por solicitante

### 📎 Upload de Arquivos
- Upload de avatares de usuários
- Integração com AWS S3
- URLs pré-assinadas para segurança

## 🛠️ Tecnologias

### Backend
- **[Fastify](https://fastify.dev/)** - Framework web rápido e eficiente
- **[TypeScript](https://www.typescriptlang.org/)** - Linguagem principal
- **[Drizzle ORM](https://orm.drizzle.team/)** - ORM type-safe para PostgreSQL
- **[Zod](https://zod.dev/)** - Validação de schemas
- **[CASL](https://casl.js.org/)** - Sistema de autorização

### Banco de Dados
- **[PostgreSQL](https://www.postgresql.org/)** com **[pgvector](https://github.com/pgvector/pgvector)**
- **[Docker](https://www.docker.com/)** para containerização

### Integrações
- **[OpenAI](https://openai.com/)** - IA para classificação de demandas
- **[AWS S3](https://aws.amazon.com/s3/)** - Armazenamento de arquivos
- **[Swagger/OpenAPI](https://swagger.io/)** - Documentação da API

### Qualidade de Código
- **[Biome](https://biomejs.dev/)** - Linter e formatter
- **[Validation BR](https://github.com/brazilian-utils/brazilian-utils)** - Validações brasileiras (CPF)

## 🚀 Início Rápido

### Pré-requisitos
- **Node.js** 18+ 
- **Docker** e **Docker Compose**
- **PostgreSQL** (ou use o Docker)

### 1. Clone o repositório
```bash
git clone https://github.com/hugoromerito/server-equipe-ativa.git
cd server-equipe-ativa
```

> **⚠️ ACESSO RESTRITO**: Este repositório é privado. Certifique-se de ter as permissões necessárias.

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL="postgresql://docker:docker@localhost:5432/agents"

# JWT
JWT_SECRET="seu-jwt-secret-super-seguro"

# OpenAI
OPENAI_API_KEY="sua-chave-da-openai"

# AWS S3
AWS_BUCKET_NAME="seu-bucket-s3"
AWS_ACCESS_KEY_ID="sua-access-key"
AWS_SECRET_ACCESS_KEY="sua-secret-key"
AWS_REGION="us-east-1"

# Server
PORT=3333
```

### 4. Inicie o banco de dados
```bash
docker-compose up -d
```

### 5. Execute as migrações
```bash
npm run db:migrate
```

### 6. (Opcional) Execute o seed
```bash
npm run db:seed
```

### 7. Inicie o servidor
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

A API estará disponível em `http://localhost:3333`

## 📚 Documentação da API

Acesse a documentação interativa do Swagger em:
```
http://localhost:3333/docs
```

### Principais Endpoints

#### 🔐 Autenticação
- `POST /auth/password` - Login com email/senha
- `POST /auth/recover` - Solicitar recuperação de senha
- `POST /auth/reset` - Resetar senha
- `GET /auth/profile` - Obter perfil do usuário

#### 🏢 Organizações
- `GET /organizations` - Listar organizações
- `POST /organizations` - Criar organização
- `PUT /organizations/:id` - Atualizar organização
- `DELETE /organizations/:id` - Desativar organização

#### 👥 Usuários e Membros
- `GET /users` - Listar usuários
- `POST /users` - Criar usuário
- `GET /organizations/:orgId/members` - Listar membros da organização

#### 📋 Demandas
- `GET /demands` - Listar demandas
- `POST /demands` - Criar demanda
- `PUT /demands/:id` - Atualizar demanda
- `GET /demands/:id` - Obter demanda específica

## 🗂️ Estrutura do Projeto

```
src/
├── config/           # Configurações (env, etc)
├── db/              # Database
│   ├── schema/      # Schemas do Drizzle
│   ├── migrations/  # Migrações SQL
│   └── auth/        # Sistema de autenticação/autorização
├── http/            # Camada HTTP
│   ├── routes/      # Definição das rotas
│   ├── middlewares/ # Middlewares (auth, upload)
│   └── utils/       # Utilitários HTTP
├── services/        # Serviços externos (S3, etc)
└── types/           # Definições de tipos TypeScript
```

## 🧪 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia o servidor em modo watch

# Produção
npm start           # Inicia o servidor

# Database
npm run db:seed     # Executa o seed do banco

# Qualidade de código
npx @biomejs/biome check .    # Verifica linting
npx @biomejs/biome format .   # Formata código
```

## 🐳 Docker

O projeto inclui configuração Docker para o banco PostgreSQL com pgvector:

```bash
# Iniciar serviços
docker-compose up -d

# Parar serviços
docker-compose down

# Ver logs
docker-compose logs
```

## 🤝 Contribuindo

**⚠️ PROJETO PRIVADO**: Este é um projeto interno da empresa. Contribuições são restritas apenas a funcionários autorizados.

Para funcionários autorizados:

1. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
2. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
3. Push para a branch (`git push origin feature/nova-feature`)
4. Abra um Pull Request interno

## 📝 Licença

Este projeto é **propriedade privada** da empresa. Todos os direitos reservados.

**⚠️ IMPORTANTE**: Este código é confidencial e proprietário. É proibida a distribuição, cópia ou modificação sem autorização expressa da empresa.

## 👨‍💻 Autor

**Hugo Queiroz** ([@hugoromerito](https://github.com/hugoromerito))

---

<div align="center">
  <strong>⭐ Se este projeto foi útil para você, considere dar uma estrela!</strong>
</div>
