ALTER TABLE "accounts" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."account_provider";--> statement-breakpoint
CREATE TYPE "public"."account_provider" AS ENUM('FACEBOOK', 'GITHUB', 'GOOGLE');--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "provider" SET DATA TYPE "public"."account_provider" USING "provider"::"public"."account_provider";--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."demand_category";--> statement-breakpoint
CREATE TYPE "public"."demand_category" AS ENUM('INFRASTRUCTURE', 'HEALTH', 'EDUCATION', 'SOCIAL_ASSISTANCE', 'PUBLICA_SAFETY', 'TRANSPORTATION', 'EMPLOYMENT', 'CULTURE', 'ENVIRONMENT', 'HUMAN_HIGHTS', 'TECHNOLOGY');--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "category" SET DATA TYPE "public"."demand_category" USING "category"::"public"."demand_category";--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "priority" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."demand_priority";--> statement-breakpoint
CREATE TYPE "public"."demand_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "priority" SET DATA TYPE "public"."demand_priority" USING "priority"::"public"."demand_priority";--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "status" SET DEFAULT 'PENDING'::text;--> statement-breakpoint
DROP TYPE "public"."demand_status";--> statement-breakpoint
CREATE TYPE "public"."demand_status" AS ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."demand_status";--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "status" SET DATA TYPE "public"."demand_status" USING "status"::"public"."demand_status";--> statement-breakpoint
ALTER TABLE "invites" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "role" SET DEFAULT 'CLERK'::text;--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'MANAGER', 'CLERK', 'ANALYST', 'BILLING');--> statement-breakpoint
ALTER TABLE "invites" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "role" SET DEFAULT 'CLERK'::"public"."role";--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "tokens" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."token_type";--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('PASSWORD_RECOVER', 'EMAIL_VERIFICATION');--> statement-breakpoint
ALTER TABLE "tokens" ALTER COLUMN "type" SET DATA TYPE "public"."token_type" USING "type"::"public"."token_type";