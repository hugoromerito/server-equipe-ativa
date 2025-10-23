ALTER TABLE "demands" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "status" SET DEFAULT 'PENDING'::text;--> statement-breakpoint
DROP TYPE "public"."demand_status";--> statement-breakpoint
CREATE TYPE "public"."demand_status" AS ENUM('PENDING', 'CHECK_IN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'BILLED');--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."demand_status";--> statement-breakpoint
ALTER TABLE "demands" ALTER COLUMN "status" SET DATA TYPE "public"."demand_status" USING "status"::"public"."demand_status";