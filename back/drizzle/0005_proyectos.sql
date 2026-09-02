-- Los planes previos no tienen proyecto: se descartan.
DELETE FROM "plan";--> statement-breakpoint
CREATE TABLE "proyecto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nombre" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan" DROP CONSTRAINT "plan_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "plan_user_proyecto_uidx";--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "proyecto_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "titulo" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "proyecto" ADD CONSTRAINT "proyecto_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proyecto_user_nombre_uidx" ON "proyecto" USING btree ("user_id","nombre");--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_proyecto_id_proyecto_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyecto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_proyecto_titulo_uidx" ON "plan" USING btree ("proyecto_id","titulo");--> statement-breakpoint
ALTER TABLE "plan" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "plan" DROP COLUMN "proyecto";