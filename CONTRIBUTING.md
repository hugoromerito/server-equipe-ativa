# Contribuindo para o Equipe Ativa API

**⚠️ PROJETO PRIVADO DA EMPRESA**

Este é um projeto interno e proprietário. Apenas funcionários autorizados podem contribuir.

## ✅ Requisitos para Contribuição

- Ser funcionário autorizado da empresa
- Ter acesso ao repositório privado
- Seguir as políticas internas de desenvolvimento

## Como Contribuir (Funcionários Autorizados)

### 🐛 Reportando Bugs

1. Verifique se o bug já não foi reportado nas [Issues](https://github.com/hugoromerito/server-equipe-ativa/issues)
2. Abra uma nova issue com:
   - Descrição clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Screenshots (se aplicável)
   - Versões (Node.js, npm, etc.)

### ✨ Sugerindo Melhorias

1. Abra uma issue com tag `enhancement`
2. Descreva claramente a melhoria proposta
3. Explique por que seria útil para o projeto

### 🔧 Contribuindo com Código

1. **Clone** o repositório (se autorizado):
   ```bash
   git clone https://github.com/hugoromerito/server-equipe-ativa.git
   ```
2. **Crie uma branch** para sua feature:
   ```bash
   git checkout -b feature/nome-da-feature
   ```
3. **Configure o ambiente**:
   ```bash
   npm install
   cp .env.example .env
   # Configure suas variáveis de ambiente
   docker-compose up -d
   ```

### 📋 Padrões de Código

- Use **TypeScript** para todo o código
- Siga as configurações do **Biome** (linter/formatter)
- Execute antes de commitar:
  ```bash
  npx @biomejs/biome check .
  npx @biomejs/biome format .
  ```

### 🧪 Testes

- Teste suas mudanças localmente
- Certifique-se que a API funciona corretamente
- Verifique os endpoints no Swagger: `http://localhost:3333/docs`

### 📝 Commits

Use o padrão **Conventional Commits**:

```
tipo(escopo): descrição

feat(auth): adiciona autenticação com Google
fix(demands): corrige bug na classificação IA
docs(readme): atualiza instruções de instalação
style(format): aplica formatação do Biome
refactor(db): reorganiza estrutura de schemas
test(api): adiciona testes para rotas de usuários
```

### 🚀 Pull Request

1. **Certifique-se** que sua branch está atualizada:
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/nome-da-feature
   git rebase main
   ```

2. **Push** sua branch:
   ```bash
   git push origin feature/nome-da-feature
   ```

3. **Abra um Pull Request** com:
   - Título claro e descritivo
   - Descrição detalhada das mudanças
   - Referência a issues relacionadas
   - Screenshots (se aplicável)

### 📁 Estrutura de Arquivos

Ao adicionar novos arquivos, siga a estrutura existente:

```
src/
├── http/routes/
│   └── nova-feature/
│       ├── create-item.ts
│       ├── get-item.ts
│       └── update-item.ts
├── db/schema/
│   └── nova-feature.ts
└── db/auth/subjects/
    └── nova-feature.ts
```

### 🔒 Segurança e Confidencialidade

- **NUNCA** commite credenciais ou chaves API
- Use `.env` para variáveis sensíveis
- **NUNCA** compartilhe código fora da empresa
- Siga as políticas de segurança da empresa
- Este código é **CONFIDENCIAL** - não pode ser copiado ou distribuído

### ❓ Dúvidas

- Contate a equipe de desenvolvimento interna
- Use os canais internos de comunicação da empresa

---

**⚠️ LEMBRETE: Este é um projeto PRIVADO e CONFIDENCIAL da empresa.**
