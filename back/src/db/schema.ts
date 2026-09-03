import { sql } from "drizzle-orm";
import {
    boolean,
    check,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.schema";

export * from "./auth.schema";

export const planStateEnum = pgEnum("plan_state", [
    "user_turn",
    "agent_turn",
    "approved",
]);
export const viewAccessEnum = pgEnum("view_access", ["owner", "everyone"]);
export const actionTypeEnum = pgEnum("action_type", ["refine", "implement"]);

// Nombre único por usuario. El agente lo crea u obtiene por nombre.
export const project = pgTable(
    "project",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (t) => [uniqueIndex("project_user_name_uidx").on(t.userId, t.name)],
);

// La versión actual no es columna: es MAX(version.number).
export const plan = pgTable("plan", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
        .notNull()
        .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    state: planStateEnum("state").notNull().default("user_turn"),
    viewAccess: viewAccessEnum("view_access").notNull().default("owner"),
    // Sesión del agente que publicó; solo informativo.
    sessionId: text("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});

// Publicación inmutable del HTML. `number` se asigna como MAX+1 dentro de la transacción.
export const version = pgTable(
    "version",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        planId: uuid("plan_id")
            .notNull()
            .references(() => plan.id, { onDelete: "cascade" }),
        number: integer("number").notNull(),
        htmlContent: text("html_content").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (t) => [uniqueIndex("version_plan_number_uidx").on(t.planId, t.number)],
);

// Pertenece a una versión y nunca se re-ancla. Sin bloque = comentario general.
export const comment = pgTable(
    "comment",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        versionId: uuid("version_id")
            .notNull()
            .references(() => version.id, { onDelete: "cascade" }),
        blockId: text("block_id"),
        // Primeros 150 caracteres de texto del bloque al comentar.
        fragment: text("fragment"),
        text: text("text").notNull(),
        attended: boolean("attended").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (t) => [
        check(
            "comment_block_fragment_check",
            sql`(${t.blockId} IS NULL AND ${t.fragment} IS NULL) OR (${t.blockId} IS NOT NULL AND ${t.fragment} IS NOT NULL)`,
        ),
    ],
);

// Decisión del usuario que cierra su turno. A lo sumo una pendiente por plan, garantizado por la BD.
export const action = pgTable(
    "action",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        planId: uuid("plan_id")
            .notNull()
            .references(() => plan.id, { onDelete: "cascade" }),
        versionId: uuid("version_id")
            .notNull()
            .references(() => version.id),
        type: actionTypeEnum("type").notNull(),
        consumed: boolean("consumed").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        consumedAt: timestamp("consumed_at", { withTimezone: true }),
    },
    (t) => [
        uniqueIndex("action_pending_per_plan_uidx")
            .on(t.planId)
            .where(sql`${t.consumed} = false`),
    ],
);

export type Plan = typeof plan.$inferSelect;
export type Version = typeof version.$inferSelect;
