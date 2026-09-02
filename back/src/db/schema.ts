import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.schema";

export * from "./auth.schema";

// Una API key por usuario; se guarda solo el hash. Regenerarla reemplaza la fila.
export const apiKey = pgTable("api_key", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  hash: text("hash").notNull().unique(),
  creadaEl: timestamp("creada_el", { withTimezone: true }).notNull().defaultNow(),
});

export const plan = pgTable("plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  proyecto: text("proyecto").notNull(),
  contenidoHtml: text("contenido_html").notNull(),
  creadoEl: timestamp("creado_el", { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plan.$inferSelect;
