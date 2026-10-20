import { describe, expect, mock, test } from "bun:test";
import {
    esMismaSesion,
    esTurnoDe,
    estadoTras,
    hashear,
    hayQueEntregar,
    nuevaApiKey,
    tituloDe,
} from "../src/services/reglas";

describe("tituloDe", () => {
    test.each([
        ["<title>Plan A</title><h1>Otro</h1>", "Plan A"],
        ["<h1>Migrar la base</h1>", "Migrar la base"],
        ["<h1 class='x'>Con <em>formato</em></h1>", "Con formato"],
        ["<title>\n  Con espacios  \n</title>", "Con espacios"],
    ])("%p se titula %p", (html, esperado) => {
        expect(tituloDe(html)).toBe(esperado);
    });

    test("sin title ni h1 usa el fallback", () => {
        expect(tituloDe("<p>solo texto</p>")).toBe("Plan sin título");
    });

    test("un title vacío no le gana al fallback", () => {
        expect(tituloDe("<title>   </title>")).toBe("Plan sin título");
    });
});

describe("esTurnoDe", () => {
    test("el usuario actúa solo en user_turn", () => {
        expect(esTurnoDe("usuario", "user_turn")).toBe(true);
        expect(esTurnoDe("usuario", "agent_turn")).toBe(false);
    });

    test("el agente publica solo en agent_turn", () => {
        expect(esTurnoDe("agente", "agent_turn")).toBe(true);
        expect(esTurnoDe("agente", "user_turn")).toBe(false);
    });

    test("en un plan aprobado no le toca a nadie", () => {
        expect(esTurnoDe("usuario", "approved")).toBe(false);
        expect(esTurnoDe("agente", "approved")).toBe(false);
    });
});

describe("estadoTras", () => {
    test("refine le pasa el turno al agente", () => {
        expect(estadoTras("refine")).toBe("agent_turn");
    });

    test("implement aprueba el plan", () => {
        expect(estadoTras("implement")).toBe("approved");
    });
});

describe("esMismaSesion", () => {
    const plan = { harness: "t3code", sessionId: "s1" };

    test("misma harness y mismo id es la misma sesión", () => {
        expect(esMismaSesion(plan, { harness: "t3code", id: "s1" })).toBe(true);
    });

    test("el mismo id desde otra harness es otra sesión", () => {
        expect(esMismaSesion(plan, { harness: "claude-code", id: "s1" })).toBe(
            false,
        );
    });

    test("un plan sin sesión no acepta a nadie", () => {
        const huerfano = { harness: null, sessionId: null };

        expect(esMismaSesion(huerfano, { harness: "t3code", id: "s1" })).toBe(
            false,
        );
    });
});

describe("hayQueEntregar", () => {
    test("sin acción no hay nada que entregar", () => {
        expect(hayQueEntregar(undefined, "agent_turn")).toBe(false);
    });

    test("una acción sin consumir se entrega", () => {
        expect(hayQueEntregar({ consumida: false }, "agent_turn")).toBe(true);
    });

    test("una acción consumida no se vuelve a entregar", () => {
        expect(hayQueEntregar({ consumida: true }, "user_turn")).toBe(false);
    });

    test("un plan aprobado re-entrega su implement consumido", () => {
        expect(hayQueEntregar({ consumida: true }, "approved")).toBe(true);
    });
});

describe("nuevaApiKey", () => {
    test("guarda una sola vez el hash de la clave, nunca la clave", async () => {
        const guardarHash = mock(async (_hash: string) => {});

        const clave = await nuevaApiKey(guardarHash);

        expect(clave).toStartWith("brd_");
        expect(guardarHash).toHaveBeenCalledTimes(1);
        expect(guardarHash).toHaveBeenCalledWith(hashear(clave));
    });

    test("si no se pudo guardar, la clave no se devuelve", async () => {
        const guardarHash = mock(async () => {
            throw new Error("base caída");
        });

        await expect(nuevaApiKey(guardarHash)).rejects.toThrow("base caída");
    });
});
