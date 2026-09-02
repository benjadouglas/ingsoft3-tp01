CREATE TABLE "api_key" (
	"user_id" text PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"creada_el" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;