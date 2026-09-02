import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const plan = pgTable("plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  proyecto: text("proyecto").notNull(),
  contenidoHtml: text("contenido_html").notNull(),
  creadoEl: timestamp("creado_el", { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plan.$inferSelect;
