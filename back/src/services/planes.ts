import { and, desc, eq, max, sql } from "drizzle-orm";
import { db } from "../db";
import { action, plan, project, version } from "../db/schema";
import { notificar } from "./eventos";

/** Título del plan: el `<title>` del documento, o el primer `<h1>`, o un fallback. */
export function tituloDe(html: string): string {
    const t =
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    return t?.replace(/<[^>]+>/g, "").trim() || "Plan sin título";
}

export type Sesion = {
    harness: string;
    id: string;
    titulo?: string;
    directorio?: string;
};

/** Crea un plan nuevo con su versión 1 en `user_turn`, creando el proyecto por nombre si no existe. */
export async function publicarPlan(
    userId: string,
    input: { proyecto: string; contenidoHtml: string; sesion: Sesion },
) {
    const creado = await db.transaction(async (tx) => {
        const [proy] = await tx
            .insert(project)
            .values({ userId, name: input.proyecto })
            .onConflictDoUpdate({
                target: [project.userId, project.name],
                set: { name: input.proyecto },
            })
            .returning({ id: project.id });
        const [creado] = await tx
            .insert(plan)
            .values({
                projectId: proy!.id,
                title: tituloDe(input.contenidoHtml),
                harness: input.sesion.harness,
                sessionId: input.sesion.id,
                sessionTitle: input.sesion.titulo,
                sessionDir: input.sesion.directorio,
            })
            .returning({ id: plan.id });
        await tx.insert(version).values({
            planId: creado!.id,
            number: 1,
            htmlContent: input.contenidoHtml,
        });
        return { id: creado!.id, version: 1 };
    });
    notificar(userId, { tipo: "plan_nuevo", planId: creado.id });
    return creado;
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
            // La acción pendiente ya llegó al agente (solo tiene sentido en agent_turn).
            entregado: sql<boolean>`exists (select 1 from ${action} where ${action.planId} = ${plan.id} and ${action.consumed} = false and ${action.deliveredAt} is not null)`,
            version: max(version.number).mapWith(Number),
            actualizadoEl: sql<string>`max(${version.createdAt})`,
            harness: plan.harness,
            sesionId: plan.sessionId,
            sesionTitulo: plan.sessionTitle,
            sesionDirectorio: plan.sessionDir,
        })
        .from(plan)
        .innerJoin(project, eq(plan.projectId, project.id))
        .innerJoin(version, eq(version.planId, plan.id))
        .where(eq(project.userId, userId))
        .groupBy(plan.id, project.name)
        .orderBy(desc(sql`max(${version.createdAt})`));
}
