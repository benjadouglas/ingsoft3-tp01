// Las reglas de la app, sin base de datos: los servicios consultan y guardan,
// y lo que deciden lo deciden acá.

export type Estado = "user_turn" | "agent_turn" | "approved";
export type Tipo = "refine" | "implement";

/** Título del plan: el `<title>` del documento, o el primer `<h1>`, o un fallback. */
export function tituloDe(html: string): string {
    const t =
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    return t?.replace(/<[^>]+>/g, "").trim() || "Plan sin título";
}

/** El usuario comenta y decide en `user_turn`; el agente publica en `agent_turn`. */
export function esTurnoDe(quien: "usuario" | "agente", estado: Estado) {
    return estado === (quien === "usuario" ? "user_turn" : "agent_turn");
}

/** `refine` le pasa el turno al agente; `implement` cierra el plan. */
export function estadoTras(tipo: Tipo): Estado {
    return tipo === "refine" ? "agent_turn" : "approved";
}

/** Solo la sesión que publicó el plan puede seguir hablando con él. */
export function esMismaSesion(
    plan: { harness: string | null; sessionId: string | null },
    sesion: { harness: string; id: string },
) {
    return plan.harness === sesion.harness && plan.sessionId === sesion.id;
}

/**
 * Se entrega la última acción si no se consumió. Un plan aprobado vuelve a
 * entregar su `implement` aunque ya esté consumido: si el agente murió justo
 * después de recibirlo, al reconectar lo recupera.
 */
export function hayQueEntregar(
    accion: { consumida: boolean } | undefined,
    estado: Estado,
) {
    return !!accion && (!accion.consumida || estado === "approved");
}

export function hashear(clave: string): string {
    return new Bun.CryptoHasher("sha256").update(clave).digest("hex");
}

/** Genera una API key y guarda solo su hash. Devuelve el texto plano: solo se ve una vez. */
export async function nuevaApiKey(
    guardarHash: (hash: string) => Promise<unknown>,
): Promise<string> {
    const clave = `brd_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")}`;
    await guardarHash(hashear(clave));
    return clave;
}
