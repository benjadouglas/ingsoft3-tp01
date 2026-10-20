export type Fase = "mi_turno" | "enviado" | "recibido" | "aprobado";

/**
 * Fase del plan para el pie de la página: en el turno del agente distingue si ya
 * recibió la acción (`recibido`) o todavía no (`enviado`).
 */
export function faseDe(
    estado: "user_turn" | "agent_turn" | "approved",
    entregado: boolean,
): Fase {
    if (estado === "approved") return "aprobado";
    if (estado === "agent_turn") return entregado ? "recibido" : "enviado";
    return "mi_turno";
}
