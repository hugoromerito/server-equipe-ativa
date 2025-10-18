ALTER TABLE "demands" ADD COLUMN "scheduled_date" date;--> statement-breakpoint
ALTER TABLE "demands" ADD COLUMN "scheduled_time" time;--> statement-breakpoint
ALTER TABLE "demands" ADD COLUMN "responsible_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "working_days" integer[];--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_responsible_id_members_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demands" DROP COLUMN "zip_code";--> statement-breakpoint
ALTER TABLE "demands" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "demands" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "demands" DROP COLUMN "street";--> statement-breakpoint
ALTER TABLE "demands" DROP COLUMN "neighborhood";--> statement-breakpoint
ALTER TABLE "demands" DROP COLUMN "complement";--> statement-breakpoint
ALTER TABLE "demands" DROP COLUMN "number";