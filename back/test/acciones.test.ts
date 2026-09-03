// Turnos, acciones y resolución: la app de Elysia en proceso contra Postgres real.
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

async function planNuevo() {
    const proy = await api("POST", "/proyectos", {
        nombre: `p-${crypto.randomUUID()}`,
    });
    const plan = await api("POST", `/proyectos/${proy.json.id}/planes`, {
        titulo: "t",
        contenidoHtml: "<section id='a'>v1</section>",
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

describe("comentarios y acciones", () => {
    test("un plan ajeno es 404 para comentar, accionar y escuchar", async () => {
        const id = await planNuevo();
        expect(
            (
                await api(
                    "POST",
                    `/planes/${id}/comentarios`,
                    { texto: "x" },
                    otraClave,
                )
            ).status,
        ).toBe(404);
        expect(
            (
                await api(
                    "POST",
                    `/planes/${id}/acciones`,
                    { tipo: "refine" },
                    otraClave,
                )
            ).status,
        ).toBe(404);
        expect(
            (
                await api(
                    "GET",
                    `/planes/${id}/acciones/siguiente?wait=0`,
                    undefined,
                    otraClave,
                )
            ).status,
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

    test("siguiente entrega la acción con sus comentarios; resolver con HTML crea v2, atiende y devuelve el turno", async () => {
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
        expect(sig.json.plan.version).toBe(1);
        expect(sig.json.comentarios.map((c: any) => c.bloqueId)).toEqual([
            "a",
            null,
        ]);
        expect(sig.json.contenidoUrl).toBe(
            `/api/planes/${id}/versiones/1/contenido`,
        );

        const res = await api(
            "POST",
            `/acciones/${sig.json.accionId}/resolver`,
            {
                contenidoHtml: "<section id='a'>v2</section>",
            },
        );
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
        expect(
            (await api("POST", `/acciones/${sig.json.accionId}/resolver`, {}))
                .status,
        ).toBe(409);
    });

    test("implement deja el plan aprobado; resolver sin HTML consume sin crear versión", async () => {
        const id = await planNuevo();
        await api("POST", `/planes/${id}/acciones`, { tipo: "implement" });
        const sig = await api("GET", `/planes/${id}/acciones/siguiente?wait=0`);
        const res = await api(
            "POST",
            `/acciones/${sig.json.accionId}/resolver`,
            {},
        );
        expect(res.json.version).toBe(1);
        expect(
            (await api("GET", `/planes/${id}/versiones/2/contenido`)).status,
        ).toBe(404);
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
