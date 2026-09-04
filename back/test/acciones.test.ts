// Turnos, acciones y versiones: la app de Elysia en proceso contra Postgres real.
// Corre con DATABASE_URL apuntando a una base con las migraciones aplicadas.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

const sesion = { harness: "codex", id: "sesion-test" };

const proyecto = `p-${crypto.randomUUID()}`;

async function planNuevo(sesionPlan = sesion) {
    const plan = await api("POST", "/planes", {
        proyecto,
        sesion: sesionPlan,
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
            await ajeno(
                "GET",
                `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
            ),
        ).toBe(404);
        expect(
            await ajeno("POST", `/planes/${id}/versiones`, {
                contenidoHtml: "x",
                sesion,
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
                    sesion,
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

        const sig = await api(
            "GET",
            `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
        );
        expect(sig.status).toBe(200);
        expect(sig.json.tipo).toBe("refine");
        expect(sig.json.comentarios.map((c: any) => c.bloqueId)).toEqual([
            "a",
            null,
        ]);
        expect(Object.keys(sig.json).sort()).toEqual(["comentarios", "tipo"]);
        // Mientras no resuelva, la misma acción se entrega de nuevo.
        expect(
            (
                await api(
                    "GET",
                    `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
                )
            ).status,
        ).toBe(200);

        const res = await api("POST", `/planes/${id}/versiones`, {
            contenidoHtml: "<section id='a'>v2</section>",
            sesion,
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
            (
                await api(
                    "GET",
                    `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
                )
            ).status,
        ).toBe(204);
    });

    test("implement es terminal: se consume al entregarlo, se vuelve a entregar y no admite versiones", async () => {
        const id = await planNuevo();
        await api("POST", `/planes/${id}/comentarios`, { texto: "dale" });
        await api("POST", `/planes/${id}/acciones`, { tipo: "implement" });
        const sig = await api(
            "GET",
            `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
        );
        expect(sig.json.tipo).toBe("implement");
        expect(
            (await api("GET", `/planes/${id}/comentarios`)).json[0].atendido,
        ).toBe(true);
        // Idempotente: si el agente murió, al reconectar lo recupera sin esperar.
        const otraVez = await api(
            "GET",
            `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
        );
        expect(otraVez.status).toBe(200);
        expect(otraVez.json.tipo).toBe("implement");
        expect(
            (
                await api("POST", `/planes/${id}/versiones`, {
                    contenidoHtml: "x",
                    sesion,
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
        const espera = api(
            "GET",
            `/planes/${id}/acciones/siguiente?wait=5&harness=${sesion.harness}&id=${sesion.id}`,
        );
        await new Promise((r) => setTimeout(r, 100));
        await api("POST", `/planes/${id}/acciones`, { tipo: "refine" });
        const sig = await espera;
        expect(sig.status).toBe(200);
        expect(sig.json.tipo).toBe("refine");
    });
});

describe("pertenencia a la sesión", () => {
    test("otra sesión no puede versionar ni recibir acciones, aunque comparta usuario", async () => {
        const id = await planNuevo();
        await api("POST", `/planes/${id}/acciones`, { tipo: "refine" });
        expect(
            (
                await api("POST", `/planes/${id}/versiones`, {
                    contenidoHtml: "x",
                })
            ).status,
        ).toBe(422);
        expect(
            (await api("GET", `/planes/${id}/acciones/siguiente?wait=0`))
                .status,
        ).toBe(422);
        for (const otra of [
            { harness: "codex", id: "otra" },
            { harness: "claude-code", id: sesion.id },
        ]) {
            expect(
                (
                    await api("POST", `/planes/${id}/versiones`, {
                        contenidoHtml: "x",
                        sesion: otra,
                    })
                ).status,
            ).toBe(403);
            expect(
                (
                    await api(
                        "GET",
                        `/planes/${id}/acciones/siguiente?wait=0&harness=${otra.harness}&id=${otra.id}`,
                    )
                ).status,
            ).toBe(403);
        }
        // Los intentos ajenos no consumen la acción ni agregan versiones.
        expect(
            (
                await api(
                    "GET",
                    `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
                )
            ).json.tipo,
        ).toBe("refine");
        expect(
            (
                await api("POST", `/planes/${id}/versiones`, {
                    contenidoHtml: "v2",
                    sesion,
                })
            ).json.version,
        ).toBe(2);
    });

    // Las dos variantes del script solo difieren en los defaults de URL, que acá se pisan por env.
    test("el script separa publish y wait por sesión dentro del mismo repo", async () => {
        const dir = await mkdtemp(join(tmpdir(), "borrador-session-"));
        const server = Bun.serve({
            port: 0,
            fetch: (request) => app.handle(request),
        });
        const script = resolve(
            import.meta.dir,
            "../../skill/handoff-html-local/scripts/borrador.sh",
        );
        const html = join(dir, "plan.html");
        await Bun.write(html, "<title>Mismo tema</title>v1");
        const env = {
            ...process.env,
            BORRADOR_URL: server.url.origin,
            BORRADOR_APP_URL: server.url.origin,
            BORRADOR_TOKEN: clave,
            XDG_STATE_HOME: join(dir, "state"),
            CODEX_HOME: dir,
            CLAUDE_CONFIG_DIR: dir,
            CODEX_THREAD_ID: "",
            CLAUDE_CODE_SESSION_ID: "",
            OPENCODE_SESSION_ID: "",
        };
        async function run(
            command: "publish" | "wait",
            identity?: typeof sesion,
            detected = false,
        ) {
            const proc = Bun.spawn(
                [
                    "bash",
                    script,
                    command,
                    ...(identity && !detected
                        ? [
                              "--harness",
                              identity.harness,
                              "--session-id",
                              identity.id,
                          ]
                        : []),
                    ...(command === "publish" ? [html] : []),
                ],
                {
                    cwd: dir,
                    env: {
                        ...env,
                        ...(detected ? { CODEX_THREAD_ID: identity?.id } : {}),
                    },
                    stdout: "pipe",
                    stderr: "pipe",
                },
            );
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(proc.stdout).text(),
                new Response(proc.stderr).text(),
                proc.exited,
            ]);
            return { stdout, stderr, exitCode };
        }
        try {
            expect((await run("publish")).exitCode).toBe(1);
            const identities = [
                sesion,
                { harness: "codex", id: "otra" },
                { harness: "claude-code", id: sesion.id },
            ];
            const ids: string[] = [];
            for (const identity of identities) {
                const result = await run(
                    "publish",
                    identity,
                    identity === sesion,
                );
                expect(result.exitCode, result.stderr).toBe(0);
                const published = JSON.parse(result.stdout);
                expect(published.version).toBe(1);
                ids.push(published.url.split("/").at(-1));
            }
            expect(new Set(ids).size).toBe(3);
            const [id] = ids;
            await api("POST", `/planes/${id}/comentarios`, {
                texto: "solo para la primera sesión",
            });
            await api("POST", `/planes/${id}/acciones`, { tipo: "refine" });
            await api("POST", `/planes/${ids[1]}/acciones`, {
                tipo: "implement",
            });
            const waited = await run("wait", sesion, true);
            expect(waited.exitCode, waited.stderr).toBe(0);
            expect(JSON.parse(waited.stdout).comentarios[0].texto).toBe(
                "solo para la primera sesión",
            );
            const otherWait = await run("wait", identities[1]);
            expect(otherWait.exitCode, otherWait.stderr).toBe(0);
            expect(JSON.parse(otherWait.stdout).tipo).toBe("implement");
            await Bun.write(html, "<title>Mismo tema</title>v2");
            const revised = await run("publish", sesion);
            expect(revised.exitCode, revised.stderr).toBe(0);
            expect(JSON.parse(revised.stdout)).toMatchObject({
                version: 2,
                url: `${server.url.origin}/planes/${id}`,
            });
            const fresh = await run("publish", identities[1]);
            expect(fresh.exitCode, fresh.stderr).toBe(0);
            expect(JSON.parse(fresh.stdout).version).toBe(1);
            expect(JSON.parse(fresh.stdout).url).not.toEndWith(ids[1]!);
        } finally {
            server.stop(true);
            await rm(dir, { recursive: true, force: true });
        }
    }, 15000);
});
