CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto" text NOT NULL,
	"contenido_html" text NOT NULL,
	"creado_el" timestamp with time zone DEFAULT now() NOT NULL
);
