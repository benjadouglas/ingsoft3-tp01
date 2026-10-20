import { describe, expect, it, vi } from "vite-plus/test";
import { load } from "./+page";

// prepararPlan usa DOMParser: acá no hay DOM, y no es lo que se prueba.
vi.mock("$lib/plan-html", () => ({
    prepararPlan: () => ({ estilos: "", cuerpo: "" }),
}));

const plan = {
    id: "p1",
    titulo: "Plan",
    version: 2,
    estado: "user_turn",
    entregado: false,
    harness: null,
};

/** Un `fetch` que responde por URL; lo que no está en `rutas` es 404. */
function fetchFalso(rutas: Record<string, unknown>) {
    return vi.fn(async (url: string) =>
        url in rutas
            ? new Response(JSON.stringify(rutas[url]))
            : new Response(null, { status: 404 }),
    );
}

function cargar(fetch: ReturnType<typeof fetchFalso>) {
    return load({
        params: { id: "p1" },
        fetch,
        depends: () => {},
    } as unknown as Parameters<typeof load>[0]);
}

describe("load de /planes/[id]", () => {
    it("pide el plan, la lista y los comentarios a la API", async () => {
        const fetch = fetchFalso({
            "/api/planes/p1": "<p></p>",
            "/api/planes": [plan],
            "/api/planes/p1/comentarios": [],
        });

        await cargar(fetch);

        expect(fetch.mock.calls.map(([url]) => url)).toEqual([
            "/api/planes/p1",
            "/api/planes",
            "/api/planes/p1/comentarios",
        ]);
    });

    it("muestra solo los comentarios pendientes de la versión actual", async () => {
        const comentarios = [
            { id: "c1", versionNumero: 2, atendido: false },
            { id: "c2", versionNumero: 2, atendido: true },
            { id: "c3", versionNumero: 1, atendido: false },
        ];
        const fetch = fetchFalso({
            "/api/planes/p1": "<p></p>",
            "/api/planes": [plan],
            "/api/planes/p1/comentarios": comentarios,
        });

        const data = await cargar(fetch);

        expect(data!.comentarios.map((c: { id: string }) => c.id)).toEqual(["c1"]);
    });

    it("si la API no encuentra el plan, la página da 404", async () => {
        const fetch = fetchFalso({
            "/api/planes": [plan],
            "/api/planes/p1/comentarios": [],
        });

        await expect(cargar(fetch)).rejects.toMatchObject({ status: 404 });
    });

    it("si el plan no está en la lista del usuario, la página da 404", async () => {
        const fetch = fetchFalso({
            "/api/planes/p1": "<p></p>",
            "/api/planes": [],
            "/api/planes/p1/comentarios": [],
        });

        await expect(cargar(fetch)).rejects.toMatchObject({ status: 404 });
    });

    it("si fallan los comentarios, la página da error en vez de mostrarlos vacíos", async () => {
        const fetch = fetchFalso({
            "/api/planes/p1": "<p></p>",
            "/api/planes": [plan],
        });

        await expect(cargar(fetch)).rejects.toMatchObject({ status: 404 });
    });
});
