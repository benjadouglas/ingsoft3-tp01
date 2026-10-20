import { describe, expect, it } from "vite-plus/test";
import { faseDe } from "./fase";

describe("faseDe", () => {
    it.each([
        ["user_turn", false, "mi_turno"],
        ["agent_turn", false, "enviado"],
        ["agent_turn", true, "recibido"],
        ["approved", true, "aprobado"],
    ] as const)("%s (entregado: %s) es %s", (estado, entregado, esperado) => {
        expect(faseDe(estado, entregado)).toBe(esperado);
    });
});
