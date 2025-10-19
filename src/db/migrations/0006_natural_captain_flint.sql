-- Criar enum weekday se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekday') THEN
        CREATE TYPE "public"."weekday" AS ENUM('DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO');
    END IF;
END $$;--> statement-breakpoint

-- Corrigir campo working_days para usar o enum correto
DO $$
BEGIN
    -- Verificar se a coluna working_days existe e é do tipo integer[]
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'members' 
        AND column_name = 'working_days'
        AND data_type = 'ARRAY'
    ) AND EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'members' 
        AND column_name = 'working_days'
        AND udt_name LIKE '%int%'
    ) THEN
        -- Se for integer[], remover e recriar como weekday[]
        ALTER TABLE "public"."members" DROP COLUMN "working_days";
        ALTER TABLE "public"."members" ADD COLUMN "working_days" "public"."weekday"[];
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'members' 
        AND column_name = 'working_days'
        AND data_type = 'ARRAY'
    ) AND EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'members' 
        AND column_name = 'working_days'
        AND udt_name = '_weekday'
    ) THEN
        -- Se já for weekday[], não fazer nada
        NULL;
    ELSE
        -- Se a coluna não existir, criar com o tipo correto
        ALTER TABLE "public"."members" ADD COLUMN "working_days" "public"."weekday"[];
    END IF;
END $$;