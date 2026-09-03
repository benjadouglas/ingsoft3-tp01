import { and, desc, eq, max } from "drizzle-orm";
import { db } from "../db";
import { action, comment, plan, project, version } from "../db/schema";

type Tipo = (typeof action.$inferSelect)["type"];

/** Plan del usuario, o undefined si no existe o es ajeno (ambos son 404). */
async function planDelUsuario(userId: string, planId: string) {
    const [fila] = await db
        .select({ id: plan.id, titulo: plan.title, estado: plan.state })
        .from(plan)
        .innerJoin(project, eq(plan.projectId, project.id))
        .where(and(eq(plan.id, planId), eq(project.userId, userId)));
    return fila;
}

async function versionActual(planId: string) {
    const [fila] = await db
        .select({ id: version.id, numero: version.number })
        .from(version)
        .where(eq(version.planId, planId))
        .orderBy(desc(version.number))
        .limit(1);
    return fila!;
}

// ---- Comentarios -----------------------------------------------------------

export async function comentar(
    userId: string,
    planId: string,
    input: { bloqueId?: string; fragmento?: string; texto: string },
): Promise<{ id: string } | "no_encontrado" | "no_es_tu_turno"> {
    const p = await planDelUsuario(userId, planId);
    if (!p) return "no_encontrado";
    if (p.estado !== "user_turn") return "no_es_tu_turno";
    const v = await versionActual(planId);
    const [creado] = await db
        .insert(comment)
        .values({
            versionId: v.id,
            blockId: input.bloqueId,
            fragment: input.fragmento,
            text: input.texto,
        })
        .returning({ id: comment.id });
    return creado!;
}

export async function listarComentarios(userId: string, planId: string) {
    if (!(await planDelUsuario(userId, planId))) return;
    return db
        .select({
            id: comment.id,
            versionNumero: version.number,
            bloqueId: comment.blockId,
            fragmento: comment.fragment,
            texto: comment.text,
            atendido: comment.attended,
        })
        .from(comment)
        .innerJoin(version, eq(comment.versionId, version.id))
        .where(eq(version.planId, planId))
        .orderBy(version.number, comment.createdAt);
}

// ---- Acciones --------------------------------------------------------------

// Canal en memoria del long-poll: quién espera por cada plan. Una sola instancia del servidor por diseño.
const esperando = new Map<string, Set<() => void>>();

function despertar(planId: string) {
    for (const fn of esperando.get(planId) ?? []) fn();
}

/** Espera hasta `ms` a que alguien cree una acción para el plan. */
function esperarAccion(planId: string, ms: number) {
    return new Promise<void>((resolve) => {
        const timer = setTimeout(listo, ms);
        function listo() {
            clearTimeout(timer);
            esperando.get(planId)?.delete(listo);
            resolve();
        }
        if (!esperando.has(planId)) esperando.set(planId, new Set());
        esperando.get(planId)!.add(listo);
    });
}

export function agenteEscuchando(planId: string) {
    return (esperando.get(planId)?.size ?? 0) > 0;
}

export async function crearAccion(
    userId: string,
    planId: string,
    tipo: Tipo,
): Promise<{ id: string } | "no_encontrado" | "no_es_tu_turno" | "pendiente"> {
    const p = await planDelUsuario(userId, planId);
    if (!p) return "no_encontrado";
    if (p.estado !== "user_turn") return "no_es_tu_turno";
    const v = await versionActual(planId);
    try {
        const creada = await db.transaction(async (tx) => {
            const [a] = await tx
                .insert(action)
                .values({ planId, versionId: v.id, type: tipo })
                .returning({ id: action.id });
            await tx
                .update(plan)
                .set({ state: tipo === "refine" ? "agent_turn" : "approved" })
                .where(eq(plan.id, planId));
            return a!;
        });
        despertar(planId);
        return creada;
    } catch (e) {
        // Índice único parcial: ya hay una acción sin consumir.
        if ((e as { code?: string }).code === "23505") return "pendiente";
        throw e;
    }
}

async function accionPendiente(userId: string, planId: string) {
    const p = await planDelUsuario(userId, planId);
    if (!p) return;
    const [a] = await db
        .select({
            id: action.id,
            tipo: action.type,
            versionId: action.versionId,
        })
        .from(action)
        .where(and(eq(action.planId, planId), eq(action.consumed, false)));
    if (!a) return null;
    const [v] = await db
        .select({ numero: version.number })
        .from(version)
        .where(eq(version.id, a.versionId));
    const comentarios = await db
        .select({
            id: comment.id,
            bloqueId: comment.blockId,
            fragmento: comment.fragment,
            texto: comment.text,
        })
        .from(comment)
        .where(eq(comment.versionId, a.versionId))
        .orderBy(comment.createdAt);
    return {
        accionId: a.id,
        tipo: a.tipo,
        plan: { id: p.id, titulo: p.titulo, version: v!.numero },
        comentarios,
        contenidoUrl: `/api/planes/${p.id}/versiones/${v!.numero}/contenido`,
    };
}

/** Long-poll: la acción pendiente, `null` si venció la espera, `undefined` si el plan no es del usuario. */
export async function siguienteAccion(
    userId: string,
    planId: string,
    waitMs: number,
) {
    const ahora = await accionPendiente(userId, planId);
    if (ahora !== null) return ahora;
    await esperarAccion(planId, waitMs);
    return accionPendiente(userId, planId);
}

export async function resolverAccion(
    userId: string,
    accionId: string,
    contenidoHtml?: string,
): Promise<{ version: number } | "no_encontrado" | "ya_resuelta"> {
    const [a] = await db
        .select({
            id: action.id,
            planId: action.planId,
            versionId: action.versionId,
            tipo: action.type,
            consumida: action.consumed,
        })
        .from(action)
        .innerJoin(plan, eq(action.planId, plan.id))
        .innerJoin(project, eq(plan.projectId, project.id))
        .where(and(eq(action.id, accionId), eq(project.userId, userId)));
    if (!a) return "no_encontrado";
    if (a.consumida) return "ya_resuelta";
    return db.transaction(async (tx) => {
        const [{ ultima }] = await tx
            .select({ ultima: max(version.number).mapWith(Number) })
            .from(version)
            .where(eq(version.planId, a.planId));
        let numero = ultima!;
        if (contenidoHtml !== undefined) {
            numero = ultima! + 1;
            await tx.insert(version).values({
                planId: a.planId,
                number: numero,
                htmlContent: contenidoHtml,
            });
        }
        await tx
            .update(action)
            .set({ consumed: true, consumedAt: new Date() })
            .where(eq(action.id, a.id));
        await tx
            .update(comment)
            .set({ attended: true })
            .where(eq(comment.versionId, a.versionId));
        if (a.tipo === "refine")
            await tx
                .update(plan)
                .set({ state: "user_turn" })
                .where(eq(plan.id, a.planId));
        return { version: numero };
    });
}

// ---- Versiones -------------------------------------------------------------

export async function obtenerHtmlVersion(
    userId: string,
    planId: string,
    numero: number,
) {
    if (!(await planDelUsuario(userId, planId))) return;
    const [fila] = await db
        .select({ html: version.htmlContent })
        .from(version)
        .where(and(eq(version.planId, planId), eq(version.number, numero)));
    return fila?.html;
}
