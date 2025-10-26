CREATE TABLE "demand_status_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demand_id" uuid NOT NULL,
	"previous_status" "demand_status" NOT NULL,
	"new_status" "demand_status" NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"changed_by_member_id" uuid,
	"changed_by_user_name" text NOT NULL,
	"changed_by_role" text NOT NULL,
	"reason" text,
	"metadata" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "demand_status_audit_log" ADD CONSTRAINT "demand_status_audit_log_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_status_audit_log" ADD CONSTRAINT "demand_status_audit_log_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_status_audit_log" ADD CONSTRAINT "demand_status_audit_log_changed_by_member_id_members_id_fk" FOREIGN KEY ("changed_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;