-- Los planes previos no tienen versiones ni proyecto en el modelo nuevo: se descartan (igual que en 0005).
DELETE FROM "plan";--> statement-breakpoint
CREATE TYPE "public"."action_type" AS ENUM('refine', 'implement');--> statement-breakpoint
CREATE TYPE "public"."plan_state" AS ENUM('user_turn', 'agent_turn', 'approved');--> statement-breakpoint
CREATE TYPE "public"."view_access" AS ENUM('owner', 'everyone');--> statement-breakpoint
CREATE TABLE "action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"type" "action_type" NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"block_id" text,
	"fragment" text,
	"text" text NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_block_fragment_check" CHECK (("comment"."block_id" IS NULL AND "comment"."fragment" IS NULL) OR ("comment"."block_id" IS NOT NULL AND "comment"."fragment" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"html_content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "proyecto" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "api_key" CASCADE;--> statement-breakpoint
DROP TABLE "proyecto" CASCADE;--> statement-breakpoint
-- DROP TABLE "proyecto" CASCADE ya se llevó esta FK.
ALTER TABLE "plan" DROP CONSTRAINT IF EXISTS "plan_proyecto_id_proyecto_id_fk";
--> statement-breakpoint
DROP INDEX "plan_proyecto_titulo_uidx";--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "state" "plan_state" DEFAULT 'user_turn' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "view_access" "view_access" DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "api_key_hash" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "api_key_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_version_id_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_version_id_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version" ADD CONSTRAINT "version_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_pending_per_plan_uidx" ON "action" USING btree ("plan_id") WHERE "action"."consumed" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "project_user_name_uidx" ON "project" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "version_plan_number_uidx" ON "version" USING btree ("plan_id","number");--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" DROP COLUMN "proyecto_id";--> statement-breakpoint
ALTER TABLE "plan" DROP COLUMN "titulo";--> statement-breakpoint
ALTER TABLE "plan" DROP COLUMN "contenido_html";--> statement-breakpoint
ALTER TABLE "plan" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "plan" DROP COLUMN "creado_el";--> statement-breakpoint
ALTER TABLE "plan" DROP COLUMN "actualizado_el";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_api_key_hash_unique" UNIQUE("api_key_hash");