import { and, desc, eq, max } from "drizzle-orm";
import { db } from "../db";
import { action, comment, plan, project, version } from "../db/schema";
import type { Sesion } from "./planes";
import { notificar } from "./eventos";

type Tipo = (typeof action.$inferSelect)["type"];

/** Plan del usuario, o undefined si no existe o es ajeno (ambos son 404). */
async function planDelUsuario(userId: string, planId: string) {
    const [fila] = await db
        .select({
            id: plan.id,
            titulo: plan.title,
            estado: plan.state,
            harness: plan.harness,
            sessionId: plan.sessionId,
        })
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

/** Comentarios de una versión, en el orden en que se hicieron. */
function comentariosDe(versionId: string) {
    return db
        .select({
            id: comment.id,
            bloqueId: comment.blockId,
            fragmento: comment.fragment,
            texto: comment.text,
        })
        .from(comment)
        .where(eq(comment.versionId, versionId))
        .orderBy(comment.createdAt);
}

/**
 * Lo que el agente recibe: el tipo de acción y los comentarios del usuario.
 * El HTML no viaja de vuelta: la fuente de verdad es la copia del agente.
 */
async function accionPendiente(
    userId: string,
    p: { id: string; estado: string },
): Promise<{
    tipo: Tipo;
    comentarios: Awaited<ReturnType<typeof comentariosDe>>;
} | null> {
    const [a] = await db
        .select({
            id: action.id,
            tipo: action.type,
            versionId: action.versionId,
            consumida: action.consumed,
            entregada: action.deliveredAt,
        })
        .from(action)
        .where(eq(action.planId, p.id))
        .orderBy(desc(action.createdAt))
        .limit(1);
    // Un plan aprobado sin pendiente vuelve a entregar su `implement`: si el agente
    // murió justo después de recibirlo, al reconectar lo recupera.
    if (!a || (a.consumida && p.estado !== "approved")) return null;
    // Primera entrega: queda registrada y el visor se entera de que el agente ya la tiene.
    if (a.entregada === null) {
        await db
            .update(action)
            .set({ deliveredAt: new Date() })
            .where(eq(action.id, a.id));
        notificar(userId, { tipo: "accion_entregada", planId: p.id });
    }
    // `implement` es terminal: se consume al entregarlo, no hay nada que resolver.
    if (!a.consumida && a.tipo === "implement") {
        await db.transaction(async (tx) => {
            await tx
                .update(action)
                .set({ consumed: true, consumedAt: new Date() })
                .where(eq(action.id, a.id));
            await tx
                .update(comment)
                .set({ attended: true })
                .where(eq(comment.versionId, a.versionId));
        });
    }
    return { tipo: a.tipo, comentarios: await comentariosDe(a.versionId) };
}

/** Long-poll: la acción pendiente, `null` si venció la espera, `undefined` si el plan no es del usuario. */
export async function siguienteAccion(
    userId: string,
    planId: string,
    waitMs: number,
    sesion: Pick<Sesion, "harness" | "id">,
) {
    const p = await planDelUsuario(userId, planId);
    if (!p) return;
    if (p.harness !== sesion.harness || p.sessionId !== sesion.id)
        return "otra_sesion";
    const ahora = await accionPendiente(userId, p);
    if (ahora) return ahora;
    await esperarAccion(planId, waitMs);
    return accionPendiente(userId, p);
}

/**
 * El agente publica una versión nueva. Solo en `agent_turn`: cierra la acción
 * pendiente, marca atendidos sus comentarios y devuelve el turno al usuario.
 */
export async function nuevaVersion(
    userId: string,
    planId: string,
    contenidoHtml: string,
    sesion: Pick<Sesion, "harness" | "id">,
): Promise<
    { version: number } | "no_encontrado" | "no_es_tu_turno" | "otra_sesion"
> {
    const p = await planDelUsuario(userId, planId);
    if (!p) return "no_encontrado";
    if (p.harness !== sesion.harness || p.sessionId !== sesion.id)
        return "otra_sesion";
    if (p.estado !== "agent_turn") return "no_es_tu_turno";
    const [a] = await db
        .select({ id: action.id, versionId: action.versionId })
        .from(action)
        .where(and(eq(action.planId, planId), eq(action.consumed, false)));
    const creada = await db.transaction(async (tx) => {
        const [{ ultima }] = await tx
            .select({ ultima: max(version.number).mapWith(Number) })
            .from(version)
            .where(eq(version.planId, planId));
        const numero = ultima! + 1;
        await tx.insert(version).values({
            planId,
            number: numero,
            htmlContent: contenidoHtml,
        });
        if (a) {
            await tx
                .update(action)
                .set({ consumed: true, consumedAt: new Date() })
                .where(eq(action.id, a.id));
            await tx
                .update(comment)
                .set({ attended: true })
                .where(eq(comment.versionId, a.versionId));
        }
        await tx
            .update(plan)
            .set({ state: "user_turn" })
            .where(eq(plan.id, planId));
        return { version: numero };
    });
    notificar(userId, { tipo: "version_nueva", planId });
    return creada;
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
