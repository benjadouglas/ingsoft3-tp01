import { sse } from "elysia";

// Canal en memoria por usuario: el browser escucha por SSE y se entera cuando
// un agente publica un plan o una versión nueva. Una sola instancia del servidor por diseño.
type Evento = { tipo: "plan_nuevo" | "version_nueva"; planId: string };

const oyentes = new Map<string, Set<(e: Evento) => void>>();

export function notificar(userId: string, evento: Evento) {
    for (const fn of oyentes.get(userId) ?? []) fn(evento);
}

/** Eventos del usuario hasta que el cliente cierre la conexión. */
export async function* eventosDe(userId: string, signal: AbortSignal) {
    const cola: Evento[] = [];
    let despertar = () => {};
    const oyente = (e: Evento) => {
        cola.push(e);
        despertar();
    };
    if (!oyentes.has(userId)) oyentes.set(userId, new Set());
    oyentes.get(userId)!.add(oyente);
    signal.addEventListener("abort", () => despertar());
    try {
        // Elysia no responde hasta el primer yield: confirmamos la conexión enseguida.
        yield sse({ event: "conectado", data: "" });
        while (!signal.aborted) {
            if (cola.length === 0)
                await new Promise<void>((r) => (despertar = r));
            for (const e of cola.splice(0))
                yield sse({ event: e.tipo, data: e });
        }
    } finally {
        oyentes.get(userId)!.delete(oyente);
    }
}
