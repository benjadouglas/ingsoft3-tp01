import { describe, expect, it } from "vite-plus/test";
import { haceCuanto } from "./fecha";

const ahora = Date.parse("2026-10-19T12:00:00Z");

describe("haceCuanto", () => {
    it.each([
        ["2026-10-19T11:59:30Z", "recién"],
        ["2026-10-19T11:59:00Z", "hace 1 minuto"],
        ["2026-10-19T09:00:00Z", "hace 3 horas"],
        ["2026-10-18T12:00:00Z", "ayer"],
        ["2026-08-19T12:00:00Z", "hace 2 meses"],
        ["2026-10-19T15:00:00Z", "dentro de 3 horas"],
    ])("%s se muestra como %s", (iso, esperado) => {
        expect(haceCuanto(iso, ahora)).toBe(esperado);
    });

    it("una fecha inválida no se muestra", () => {
        expect(haceCuanto("no es una fecha", ahora)).toBe("");
    });
});
