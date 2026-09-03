import { and, desc, eq, max, sql } from "drizzle-orm";
import { db } from "../db";
import { plan, project, version } from "../db/schema";

/** Devuelve el proyecto del usuario con ese nombre, creándolo si no existe. */
export async function obtenerOCrearProyecto(userId: string, nombre: string) {
    const [fila] = await db
        .insert(project)
        .values({ userId, name: nombre })
        .onConflictDoUpdate({
            target: [project.userId, project.name],
            set: { name: nombre },
        })
        .returning({ id: project.id, nombre: project.name });
    return fila;
}

/** Crea un plan nuevo con su versión 1 y lo deja en `user_turn`. */
export async function publicarPlan(
    userId: string,
    input: {
        proyectoId: string;
        titulo: string;
        contenidoHtml: string;
        sessionId?: string;
    },
) {
    const dueño = await db.query.project.findFirst({
        where: and(
            eq(project.id, input.proyectoId),
            eq(project.userId, userId),
        ),
    });
    if (!dueño) return;
    return db.transaction(async (tx) => {
        const [creado] = await tx
            .insert(plan)
            .values({
                projectId: input.proyectoId,
                title: input.titulo,
                sessionId: input.sessionId,
            })
            .returning({ id: plan.id });
        await tx
            .insert(version)
            .values({
                planId: creado!.id,
                number: 1,
                htmlContent: input.contenidoHtml,
            });
        return { id: creado!.id, version: 1 };
    });
}

/** HTML de la versión actual del plan, si pertenece al usuario. */
export async function obtenerHtmlActual(
    userId: string,
    id: string,
): Promise<string | undefined> {
    const [fila] = await db
        .select({ html: version.htmlContent })
        .from(version)
        .innerJoin(plan, eq(version.planId, plan.id))
        .innerJoin(project, eq(plan.projectId, project.id))
        .where(and(eq(plan.id, id), eq(project.userId, userId)))
        .orderBy(desc(version.number))
        .limit(1);
    return fila?.html;
}

export async function listarPlanes(userId: string) {
    return db
        .select({
            id: plan.id,
            titulo: plan.title,
            proyecto: project.name,
            estado: plan.state,
            version: max(version.number).mapWith(Number),
            actualizadoEl: sql<string>`max(${version.createdAt})`,
        })
        .from(plan)
        .innerJoin(project, eq(plan.projectId, project.id))
        .innerJoin(version, eq(version.planId, plan.id))
        .where(eq(project.userId, userId))
        .groupBy(plan.id, project.name)
        .orderBy(desc(sql`max(${version.createdAt})`));
}
