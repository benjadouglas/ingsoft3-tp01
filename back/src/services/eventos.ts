import { sse } from "elysia";

// Canal en memoria por usuario: el browser escucha por SSE y se entera cuando
// un agente publica un plan o una versión nueva. Una sola instancia del servidor por diseño.
type Evento = {
    tipo: "plan_nuevo" | "version_nueva" | "accion_entregada";
    planId: string;
};

const LATIDO_MS = 30_000;

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
            if (cola.length === 0) {
                // Sin novedades, un latido cada 30s mantiene viva la conexión.
                let latido: ReturnType<typeof setTimeout> | undefined;
                await new Promise<void>((r) => {
                    despertar = r;
                    latido = setTimeout(r, LATIDO_MS);
                });
                clearTimeout(latido);
                if (cola.length === 0) {
                    yield sse({ event: "latido", data: "" });
                    continue;
                }
            }
            for (const e of cola.splice(0))
                yield sse({ event: e.tipo, data: e });
        }
    } finally {
        oyentes.get(userId)!.delete(oyente);
    }
}
