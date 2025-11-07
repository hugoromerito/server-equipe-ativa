-- Migration: TV Access Tokens
-- Criado em: 2025-10-30
-- Descrição: Sistema de códigos de acesso para TVs exibirem chamadas de pacientes

-- Criar enum para status do token
CREATE TYPE tv_token_status AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- Criar tabela de tokens de acesso para TV
CREATE TABLE "tv_access_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Código de 6 caracteres (alfanumérico, único)
  "code" VARCHAR(6) UNIQUE NOT NULL,
  
  -- Relacionamentos
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "unit_id" UUID NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "created_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  
  -- Metadados
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  
  -- Status e validade
  "status" tv_token_status NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP WITH TIME ZONE,
  
  -- Auditoria
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE,
  "revoked_at" TIMESTAMP WITH TIME ZONE,
  "revoked_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  
  -- Controle de uso
  "last_used_at" TIMESTAMP WITH TIME ZONE,
  "last_ip_address" VARCHAR(45),
  "usage_count" INTEGER DEFAULT 0 NOT NULL
);

-- Índices para performance
CREATE INDEX "idx_tv_access_tokens_code" ON "tv_access_tokens"("code");
CREATE INDEX "idx_tv_access_tokens_status" ON "tv_access_tokens"("status");
CREATE INDEX "idx_tv_access_tokens_organization" ON "tv_access_tokens"("organization_id");
CREATE INDEX "idx_tv_access_tokens_unit" ON "tv_access_tokens"("unit_id");
CREATE INDEX "idx_tv_access_tokens_expires_at" ON "tv_access_tokens"("expires_at");

-- Comentários para documentação
COMMENT ON TABLE "tv_access_tokens" IS 'Códigos de acesso para TVs exibirem chamadas de pacientes em tempo real';
COMMENT ON COLUMN "tv_access_tokens"."code" IS 'Código alfanumérico de 6 caracteres (evita I/1, O/0)';
COMMENT ON COLUMN "tv_access_tokens"."status" IS 'Status: ACTIVE (ativo), EXPIRED (expirado), REVOKED (revogado)';
COMMENT ON COLUMN "tv_access_tokens"."usage_count" IS 'Contador de quantas vezes o código foi usado';
