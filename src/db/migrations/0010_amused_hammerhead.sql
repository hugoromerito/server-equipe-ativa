CREATE TYPE "public"."tv_token_status" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TABLE "tv_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(6) NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"status" "tv_token_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"last_used_at" timestamp with time zone,
	"last_ip_address" varchar(45),
	"usage_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tv_access_tokens_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "tv_access_tokens" ADD CONSTRAINT "tv_access_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_access_tokens" ADD CONSTRAINT "tv_access_tokens_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_access_tokens" ADD CONSTRAINT "tv_access_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_access_tokens" ADD CONSTRAINT "tv_access_tokens_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tv_access_tokens_code" ON "tv_access_tokens" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_tv_access_tokens_status" ON "tv_access_tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tv_access_tokens_organization" ON "tv_access_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_tv_access_tokens_unit" ON "tv_access_tokens" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_tv_access_tokens_expires_at" ON "tv_access_tokens" USING btree ("expires_at");