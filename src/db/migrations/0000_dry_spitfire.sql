CREATE TYPE "public"."account_provider" AS ENUM('facebook', 'github', 'google');--> statement-breakpoint
CREATE TYPE "public"."demand_category" AS ENUM('infrastructure', 'health', 'education', 'social_assistance', 'public_safety', 'transportation', 'employment', 'culture', 'environment', 'human_rights', 'technology');--> statement-breakpoint
CREATE TYPE "public"."demand_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."demand_status" AS ENUM('pending', 'in_progress', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'manager', 'clerk', 'analyst', 'billing');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('password_recover', 'email_verification');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "account_provider" NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "accounts_provider_account_id_unique" UNIQUE("provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "applicants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"birthdate" date NOT NULL,
	"cpf" text NOT NULL,
	"mother" text,
	"father" text,
	"attachment" text,
	"observation" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"organization_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "demands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "demand_status" DEFAULT 'pending' NOT NULL,
	"priority" "demand_priority" NOT NULL,
	"category" "demand_category" NOT NULL,
	"zip_code" text,
	"state" text,
	"city" text,
	"street" text,
	"neighborhood" text,
	"complement" text,
	"number" text,
	"attachment" text,
	"created_by_member_name" text NOT NULL,
	"updated_by_member_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"applicant_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"owner_id" uuid,
	"member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"author_id" uuid,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "role" DEFAULT 'clerk' NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"should_attach_users_by_domain" boolean DEFAULT false,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"owner_id" uuid NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "token_type" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"description" text,
	"location" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"owner_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	CONSTRAINT "units_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"password_hash" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_user_id" ON "accounts" USING btree ("provider","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cpf_organization_id" ON "applicants" USING btree ("cpf","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_organization_id_unit_id" ON "invites" USING btree ("email","organization_id","unit_id");--> statement-breakpoint
CREATE INDEX "email" ON "invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_id_organization_id_unit_id" ON "members" USING btree ("user_id","organization_id","unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_slug_org_id" ON "units" USING btree ("slug","organization_id");