-- Criação segura dos enums (se não existirem)
DO $$ 
BEGIN
    -- Criar demand_status se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_status') THEN
        CREATE TYPE "public"."demand_status" AS ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'BILLED');
    ELSE
        -- Adicionar BILLED se ainda não existir
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BILLED' AND enumtypid = 'public.demand_status'::regtype) THEN
            ALTER TYPE "public"."demand_status" ADD VALUE 'BILLED';
        END IF;
    END IF;
END $$;
--> statement-breakpoint

-- Atualizar demand_category
DO $$ 
BEGIN
    -- Verificar se a tabela demands existe antes de modificar
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'demands') THEN
        -- Converter coluna para text temporariamente
        ALTER TABLE "demands" ALTER COLUMN "category" SET DATA TYPE text;
        
        -- Remover enum antigo se existir
        DROP TYPE IF EXISTS "public"."demand_category" CASCADE;
        
        -- Criar novo enum
        CREATE TYPE "public"."demand_category" AS ENUM('SOCIAL_WORKER', 'PSYCHOMOTOR_PHYSIOTHERAPIST', 'SPEECH_THERAPIST', 'MUSIC_THERAPIST', 'NEUROPSYCHOPEDAGOGUE', 'NEUROPSYCHOLOGIST', 'NUTRITIONIST', 'PSYCHOLOGIST', 'PSYCHOMOTRICIAN', 'PSYCHOPEDAGOGUE', 'THERAPIST', 'OCCUPATIONAL_THERAPIST');
        
        -- Converter coluna de volta para enum
        ALTER TABLE "demands" ALTER COLUMN "category" SET DATA TYPE "public"."demand_category" USING "category"::"public"."demand_category";
    ELSE
        -- Se a tabela não existe, apenas criar o enum
        DROP TYPE IF EXISTS "public"."demand_category" CASCADE;
        CREATE TYPE "public"."demand_category" AS ENUM('SOCIAL_WORKER', 'PSYCHOMOTOR_PHYSIOTHERAPIST', 'SPEECH_THERAPIST', 'MUSIC_THERAPIST', 'NEUROPSYCHOPEDAGOGUE', 'NEUROPSYCHOLOGIST', 'NUTRITIONIST', 'PSYCHOLOGIST', 'PSYCHOMOTRICIAN', 'PSYCHOPEDAGOGUE', 'THERAPIST', 'OCCUPATIONAL_THERAPIST');
    END IF;
END $$;
--> statement-breakpoint

-- Criar tabela job_titles se não existir
CREATE TABLE IF NOT EXISTS "job_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid
);
--> statement-breakpoint

-- Adicionar coluna job_title_id em members se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'job_title_id'
    ) THEN
        ALTER TABLE "members" ADD COLUMN "job_title_id" uuid;
    END IF;
END $$;
--> statement-breakpoint

-- Criar constraints se não existirem
DO $$ 
BEGIN
    -- Foreign key para organization_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'job_titles_organization_id_organizations_id_fk'
    ) THEN
        ALTER TABLE "job_titles" ADD CONSTRAINT "job_titles_organization_id_organizations_id_fk" 
        FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    
    -- Foreign key para unit_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'job_titles_unit_id_units_id_fk'
    ) THEN
        ALTER TABLE "job_titles" ADD CONSTRAINT "job_titles_unit_id_units_id_fk" 
        FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    
    -- Foreign key para job_title_id em members
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'members_job_title_id_job_titles_id_fk'
    ) THEN
        ALTER TABLE "members" ADD CONSTRAINT "members_job_title_id_job_titles_id_fk" 
        FOREIGN KEY ("job_title_id") REFERENCES "public"."job_titles"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Criar índice único se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'job_title_name_org_unit'
    ) THEN
        CREATE UNIQUE INDEX "job_title_name_org_unit" ON "job_titles" USING btree ("name","organization_id","unit_id");
    END IF;
END $$;
