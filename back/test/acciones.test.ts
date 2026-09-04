// Turnos, acciones y versiones: la app de Elysia en proceso contra Postgres real.
// Corre con DATABASE_URL apuntando a una base con las migraciones aplicadas.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db, migrar } from "../src/db";
import { user } from "../src/db/schema";

const clave = `brd_test_${crypto.randomUUID()}`;
const userId = `test-${crypto.randomUUID()}`;
const otraClave = `brd_test_${crypto.randomUUID()}`;
const otroId = `test-${crypto.randomUUID()}`;

function sha256(s: string) {
    return new Bun.CryptoHasher("sha256").update(s).digest("hex");
}

async function api(
    method: string,
    path: string,
    body?: unknown,
    token = clave,
) {
    const res = await app.handle(
        new Request(`http://test/api${path}`, {
            method,
            headers: {
                authorization: `Bearer ${token}`,
                ...(body ? { "content-type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        }),
    );
    const text = await res.text();
    let json: any;
    try {
        json = JSON.parse(text);
    } catch {
        json = text;
    }
    return { status: res.status, json };
}

const proyecto = `p-${crypto.randomUUID()}`;

async function planNuevo() {
    const plan = await api("POST", "/planes", {
        proyecto,
        contenidoHtml: "<title>t</title><section id='a'>v1</section>",
    });
    return plan.json.id as string;
}

beforeAll(async () => {
    await migrar();
    await db.insert(user).values([
        {
            id: userId,
            name: "t",
            email: `${userId}@test`,
            apiKeyHash: sha256(clave),
        },
        {
            id: otroId,
            name: "o",
            email: `${otroId}@test`,
            apiKeyHash: sha256(otraClave),
        },
    ]);
});

afterAll(async () => {
    // Cascada: user → project → plan → version → comment / action.
    await db.delete(user).where(eq(user.id, userId));
    await db.delete(user).where(eq(user.id, otroId));
});

describe("publicar", () => {
    test("crea el proyecto por nombre y toma el título del HTML", async () => {
        const id = await planNuevo();
        await planNuevo();
        const lista = (await api("GET", "/planes")).json;
        const mio = lista.find((p: any) => p.id === id);
        expect(mio).toMatchObject({
            titulo: "t",
            proyecto,
            estado: "user_turn",
            version: 1,
        });
        expect(new Set(lista.map((p: any) => p.proyecto)).size).toBe(1);
    });

    test("guarda la sesión del agente y la devuelve en la lista", async () => {
        const sesion = {
            harness: "claude-code",
            id: "abc",
            titulo: "Plan t",
            directorio: "/repo",
        };
        const { json } = await api("POST", "/planes", {
            proyecto,
            contenidoHtml: "<title>t</title><section id='a'>v1</section>",
            sesion,
        });
        const lista = (await api("GET", "/planes")).json;
        expect(lista.find((p: any) => p.id === json.id)).toMatchObject({
            harness: "claude-code",
            sesionId: "abc",
            sesionTitulo: "Plan t",
            sesionDirectorio: "/repo",
        });
    });
});

describe("comentarios y acciones", () => {
    test("un plan ajeno es 404 para comentar, accionar, escuchar y versionar", async () => {
        const id = await planNuevo();
        const ajeno = (m: string, p: string, b?: unknown) =>
            api(m, p, b, otraClave).then((r) => r.status);
        expect(
            await ajeno("POST", `/planes/${id}/comentarios`, { texto: "x" }),
        ).toBe(404);
        expect(
            await ajeno("POST", `/planes/${id}/acciones`, { tipo: "refine" }),
        ).toBe(404);
        expect(
            await ajeno("GET", `/planes/${id}/acciones/siguiente?wait=0`),
        ).toBe(404);
        expect(
            await ajeno("POST", `/planes/${id}/versiones`, {
                contenidoHtml: "x",
            }),
        ).toBe(404);
    });

    test("refine cierra el turno: comentar y accionar de nuevo dan 409", async () => {
        const id = await planNuevo();
        expect(
            (
                await api("POST", `/planes/${id}/comentarios`, {
                    bloqueId: "a",
                    fragmento: "v1",
                    texto: "más corto",
                })
            ).status,
        ).toBe(201);
        expect(
            (await api("POST", `/planes/${id}/acciones`, { tipo: "refine" }))
                .status,
        ).toBe(201);
        expect(
            (await api("POST", `/planes/${id}/comentarios`, { texto: "tarde" }))
                .status,
        ).toBe(409);
        expect(
            (await api("POST", `/planes/${id}/acciones`, { tipo: "refine" }))
                .status,
        ).toBe(409);
    });

    test("en turno del usuario el agente no puede publicar versión", async () => {
        const id = await planNuevo();
        expect(
            (
                await api("POST", `/planes/${id}/versiones`, {
                    contenidoHtml: "x",
                })
            ).status,
        ).toBe(409);
    });

    test("siguiente entrega tipo y comentarios; la versión nueva atiende y devuelve el turno", async () => {
        const id = await planNuevo();
        await api("POST", `/planes/${id}/comentarios`, {
            bloqueId: "a",
            fragmento: "v1",
            texto: "más corto",
        });
        await api("POST", `/planes/${id}/comentarios`, {
            texto: "en general, bien",
        });
        await api("POST", `/planes/${id}/acciones`, { tipo: "refine" });

        const sig = await api("GET", `/planes/${id}/acciones/siguiente?wait=0`);
        expect(sig.status).toBe(200);
        expect(sig.json.tipo).toBe("refine");
        expect(sig.json.comentarios.map((c: any) => c.bloqueId)).toEqual([
            "a",
            null,
        ]);
        expect(Object.keys(sig.json).sort()).toEqual(["comentarios", "tipo"]);
        // Mientras no resuelva, la misma acción se entrega de nuevo.
        expect(
            (await api("GET", `/planes/${id}/acciones/siguiente?wait=0`))
                .status,
        ).toBe(200);

        const res = await api("POST", `/planes/${id}/versiones`, {
            contenidoHtml: "<section id='a'>v2</section>",
        });
        expect(res.status).toBe(200);
        expect(res.json.version).toBe(2);
        expect(
            (await api("GET", `/planes/${id}/versiones/2/contenido`)).json,
        ).toBe("<section id='a'>v2</section>");
        expect(
            (await api("GET", `/planes/${id}/comentarios`)).json.every(
                (c: any) => c.atendido,
            ),
        ).toBe(true);
        // De vuelta en user_turn: se puede comentar, y no queda nada pendiente.
        expect(
            (
                await api("POST", `/planes/${id}/comentarios`, {
                    texto: "otra vuelta",
                })
            ).status,
        ).toBe(201);
        expect(
            (await api("GET", `/planes/${id}/acciones/siguiente?wait=0`))
                .status,
        ).toBe(204);
    });

    test("implement es terminal: se consume al entregarlo, se vuelve a entregar y no admite versiones", async () => {
        const id = await planNuevo();
        await api("POST", `/planes/${id}/comentarios`, { texto: "dale" });
        await api("POST", `/planes/${id}/acciones`, { tipo: "implement" });
        const sig = await api("GET", `/planes/${id}/acciones/siguiente?wait=0`);
        expect(sig.json.tipo).toBe("implement");
        expect(
            (await api("GET", `/planes/${id}/comentarios`)).json[0].atendido,
        ).toBe(true);
        // Idempotente: si el agente murió, al reconectar lo recupera sin esperar.
        const otraVez = await api(
            "GET",
            `/planes/${id}/acciones/siguiente?wait=0`,
        );
        expect(otraVez.status).toBe(200);
        expect(otraVez.json.tipo).toBe("implement");
        expect(
            (
                await api("POST", `/planes/${id}/versiones`, {
                    contenidoHtml: "x",
                })
            ).status,
        ).toBe(409);
        expect(
            (await api("POST", `/planes/${id}/comentarios`, { texto: "x" }))
                .status,
        ).toBe(409);
    });

    test("el long-poll despierta cuando se crea la acción mientras espera", async () => {
        const id = await planNuevo();
        const espera = api("GET", `/planes/${id}/acciones/siguiente?wait=5`);
        await new Promise((r) => setTimeout(r, 100));
        await api("POST", `/planes/${id}/acciones`, { tipo: "refine" });
        const sig = await espera;
        expect(sig.status).toBe(200);
        expect(sig.json.tipo).toBe("refine");
    });
});
