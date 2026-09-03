import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { plan, proyecto, type Plan } from "../db/schema";

/** Devuelve el proyecto del usuario con ese nombre, creándolo si no existe. */
export async function obtenerOCrearProyecto(userId: string, nombre: string) {
    const [fila] = await db
        .insert(proyecto)
        .values({ userId, nombre })
        .onConflictDoUpdate({
            target: [proyecto.userId, proyecto.nombre],
            set: { nombre },
        })
        .returning({ id: proyecto.id, nombre: proyecto.nombre });
    return fila;
}

export async function publicarPlan(
    userId: string,
    input: { proyectoId: string; titulo: string; contenidoHtml: string },
): Promise<Plan | undefined> {
    const dueño = await db.query.proyecto.findFirst({
        where: and(
            eq(proyecto.id, input.proyectoId),
            eq(proyecto.userId, userId),
        ),
    });
    if (!dueño) return;
    const [guardado] = await db
        .insert(plan)
        .values(input)
        .onConflictDoUpdate({
            target: [plan.proyectoId, plan.titulo],
            set: {
                contenidoHtml: input.contenidoHtml,
                version: sql`${plan.version} + 1`,
                actualizadoEl: new Date(),
            },
        })
        .returning();
    return guardado;
}

export async function obtenerPlan(
    userId: string,
    id: string,
): Promise<Plan | undefined> {
    const [fila] = await db
        .select({ plan })
        .from(plan)
        .innerJoin(proyecto, eq(plan.proyectoId, proyecto.id))
        .where(and(eq(plan.id, id), eq(proyecto.userId, userId)));
    return fila?.plan;
}

export async function listarPlanes(userId: string) {
    return db
        .select({
            id: plan.id,
            titulo: plan.titulo,
            proyecto: proyecto.nombre,
            version: plan.version,
            actualizadoEl: plan.actualizadoEl,
        })
        .from(plan)
        .innerJoin(proyecto, eq(plan.proyectoId, proyecto.id))
        .where(eq(proyecto.userId, userId))
        .orderBy(desc(plan.actualizadoEl));
}
