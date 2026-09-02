-- Los planes previos no tienen dueño: se descartan.
DELETE FROM "plan";--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "actualizado_el" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_user_proyecto_uidx" ON "plan" USING btree ("user_id","proyecto");