import {
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.schema";

export * from "./auth.schema";

// Una API key por usuario; se guarda solo el hash. Regenerarla reemplaza la fila.
export const apiKey = pgTable("api_key", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    hash: text("hash").notNull().unique(),
    creadaEl: timestamp("creada_el", { withTimezone: true })
        .notNull()
        .defaultNow(),
});

// Nombre único por usuario. El agente lo crea u obtiene por nombre.
export const proyecto = pgTable(
    "proyecto",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        nombre: text("nombre").notNull(),
    },
    (t) => [uniqueIndex("proyecto_user_nombre_uidx").on(t.userId, t.nombre)],
);

// Un plan por (proyecto, título): publicar de nuevo reemplaza el HTML, conserva id y URL y suma versión.
export const plan = pgTable(
    "plan",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        proyectoId: uuid("proyecto_id")
            .notNull()
            .references(() => proyecto.id, { onDelete: "cascade" }),
        titulo: text("titulo").notNull(),
        contenidoHtml: text("contenido_html").notNull(),
        version: integer("version").notNull().default(1),
        creadoEl: timestamp("creado_el", { withTimezone: true })
            .notNull()
            .defaultNow(),
        actualizadoEl: timestamp("actualizado_el", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (t) => [
        uniqueIndex("plan_proyecto_titulo_uidx").on(t.proyectoId, t.titulo),
    ],
);

export type Plan = typeof plan.$inferSelect;
