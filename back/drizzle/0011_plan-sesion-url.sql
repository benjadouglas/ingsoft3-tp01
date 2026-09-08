ALTER TABLE "plan" ADD COLUMN "session_url" text;
--> statement-breakpoint
-- Codex y Cursor dejan de ser harness propios: dentro de T3 Code publican como `t3code`.
DELETE FROM "plan" WHERE "harness" IN ('codex', 'cursor');
