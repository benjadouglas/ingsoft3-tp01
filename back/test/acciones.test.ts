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

const sesion = { harness: "t3code", id: "sesion-test" };

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
            url: "http://t3.local:3773/env/abc",
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
            sesionUrl: "http://t3.local:3773/env/abc",
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

    test("rebotar deshace la acción: vuelve a user_turn con los comentarios sin atender", async () => {
        const id = await planNuevo();
        await api("POST", `/planes/${id}/comentarios`, { texto: "dale" });
        // Sin acción no hay nada que rebotar.
        expect(
            (await api("POST", `/planes/${id}/acciones/rebotar`, { sesion }))
                .status,
        ).toBe(409);
        for (const tipo of ["refine", "implement"] as const) {
            await api("POST", `/planes/${id}/acciones`, { tipo });
            // Incluso ya entregado y consumido (implement), el rebote lo deshace.
            await api(
                "GET",
                `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
            );
            expect(
                (
                    await api("POST", `/planes/${id}/acciones/rebotar`, {
                        sesion: { harness: "claude-code", id: sesion.id },
                    })
                ).status,
            ).toBe(403);
            expect(
                (
                    await api("POST", `/planes/${id}/acciones/rebotar`, {
                        sesion,
                    })
                ).status,
            ).toBe(204);
            const lista = (await api("GET", "/planes")).json;
            expect(lista.find((p: any) => p.id === id).estado).toBe(
                "user_turn",
            );
            expect(
                (await api("GET", `/planes/${id}/comentarios`)).json.map(
                    (c: any) => c.atendido,
                ),
            ).toEqual([false]);
            expect(
                (
                    await api(
                        "GET",
                        `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`,
                    )
                ).status,
            ).toBe(204);
        }
        // Se puede volver a enviar.
        expect(
            (await api("POST", `/planes/${id}/acciones`, { tipo: "refine" }))
                .status,
        ).toBe(201);
    });

    test("tras rebotar se pueden editar y borrar comentarios sin duplicarlos al reenviar", async () => {
        const id = await planNuevo();
        const comentarios = [
            { bloqueId: "a", fragmento: "v1", texto: "corregir" },
            { bloqueId: null, fragmento: null, texto: "borrar" },
        ];
        expect((await api("POST", `/planes/${id}/acciones`, {
            tipo: "refine", comentarios,
        })).status).toBe(201);
        expect((await api("POST", `/planes/${id}/acciones`, {
            tipo: "refine", comentarios: [],
        })).status).toBe(409);
        expect((await api("POST", `/planes/${id}/acciones/rebotar`, { sesion })).status).toBe(204);
        const guardados = (await api("GET", `/planes/${id}/comentarios`)).json;
        expect(guardados.map((c: { texto: string }) => c.texto)).toEqual(["corregir", "borrar"]);
        expect(guardados.every((c: { atendido: boolean }) => !c.atendido)).toBe(true);

        const editados = [{ ...comentarios[0], texto: "corregido" }];
        expect((await api("POST", `/planes/${id}/acciones`, {
            tipo: "refine", comentarios: editados,
        })).status).toBe(201);
        const entrega = await api("GET", `/planes/${id}/acciones/siguiente?wait=0&harness=${sesion.harness}&id=${sesion.id}`);
        expect(entrega.json.comentarios).toHaveLength(1);
        expect(entrega.json.comentarios[0].texto).toBe("corregido");

        await api("POST", `/planes/${id}/acciones/rebotar`, { sesion });
        expect((await api("POST", `/planes/${id}/acciones`, {
            tipo: "implement", comentarios: [],
        })).status).toBe(201);
        expect((await api("GET", `/planes/${id}/comentarios`)).json).toEqual([]);
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
            { harness: "t3code", id: "otra" },
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

    // La skill delega al cliente Node; las URLs acá se configuran por entorno.
    test("el script separa publish y wait por sesión dentro del mismo repo", async () => {
        const dir = await mkdtemp(join(tmpdir(), "borrador-session-"));
        const server = Bun.serve({
            port: 0,
            fetch: (request) => app.handle(request),
        });
        const script = resolve(
            import.meta.dir,
            "../../skill/handoff-html/scripts/borrador",
        );
        const html = join(dir, "plan.html");
        await Bun.write(html, "<title>Mismo tema</title>v1");
        const claude = { harness: "claude-code", id: "sesion-claude" };
        const env = {
            ...process.env,
            BORRADOR_URL: server.url.origin,
            BORRADOR_APP_URL: server.url.origin,
            BORRADOR_TOKEN: clave,
            BORRADOR_HARNESS: "claude",
            XDG_STATE_HOME: join(dir, "state"),
            CLAUDE_CONFIG_DIR: dir,
            CLAUDE_CODE_SESSION_ID: "",
        };
        async function run(
            command: "publish" | "wait",
            identity?: { harness: string; id: string },
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
                        ...(detected
                            ? { CLAUDE_CODE_SESSION_ID: identity?.id }
                            : {}),
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
                claude,
                { harness: "claude-code", id: "otra" },
            ];
            const ids: string[] = [];
            for (const identity of identities) {
                const result = await run(
                    "publish",
                    identity,
                    identity === claude,
                );
                expect(result.exitCode, result.stderr).toBe(0);
                const published = JSON.parse(result.stdout);
                expect(published.version).toBe(1);
                ids.push(published.url.split("/").at(-1));
            }
            expect(new Set(ids).size).toBe(2);
            const [id] = ids;
            await api("POST", `/planes/${id}/comentarios`, {
                texto: "solo para la primera sesión",
            });
            await api("POST", `/planes/${id}/acciones`, { tipo: "refine" });
            await api("POST", `/planes/${ids[1]}/acciones`, {
                tipo: "implement",
            });
            const waited = await run("wait", claude, true);
            expect(waited.exitCode, waited.stderr).toBe(0);
            expect(JSON.parse(waited.stdout).comentarios[0].texto).toBe(
                "solo para la primera sesión",
            );
            const otherWait = await run("wait", identities[1]);
            expect(otherWait.exitCode, otherWait.stderr).toBe(0);
            expect(JSON.parse(otherWait.stdout).tipo).toBe("implement");
            await Bun.write(html, "<title>Mismo tema</title>v2");
            const revised = await run("publish", claude);
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

    // En T3 Code el script resuelve el thread por la API de T3 y deja `sesion.json` para el bridge.
    test("en T3 Code publish resuelve el thread activo del repo y guarda sesion.json", async () => {
        const dir = await mkdtemp(join(tmpdir(), "borrador-t3-"));
        const server = Bun.serve({
            port: 0,
            fetch: (request) => app.handle(request),
        });
        const proyectoT3 = crypto.randomUUID();
        const threads = [
            { id: "t-activo", title: "Plan del repo", proj: proyectoT3, activo: true },
            { id: "t-quieto", title: "Otro", proj: proyectoT3, activo: false },
            { id: "t-ajeno", title: "Ajeno", proj: "otro-proyecto", activo: true },
        ];
        const t3 = Bun.serve({
            port: 0,
            fetch: (request) => {
                const { pathname } = new URL(request.url);
                if (pathname === "/.well-known/t3/environment")
                    return Response.json({ environmentId: "env-1" });
                if (request.headers.get("authorization") !== "Bearer t3-token")
                    return new Response("no", { status: 401 });
                if (pathname === "/api/orchestration/shell")
                    return Response.json({
                        // Como lo guarda T3: con `~` y otra capitalización.
                        projects: [
                            {
                                id: proyectoT3,
                                workspaceRoot: dir.replace(
                                    process.env.HOME!,
                                    "~",
                                ).toUpperCase().replace("~", "~"),
                            },
                            { id: "otro-proyecto", workspaceRoot: "/otro" },
                        ],
                        threads: threads.map((t) => ({
                            id: t.id,
                            title: t.title,
                            projectId: t.proj,
                            archivedAt: null,
                            session: { activeTurnId: t.activo ? "turno" : null },
                        })),
                    });
                return new Response("?", { status: 404 });
            },
        });
        const script = resolve(
            import.meta.dir,
            "../../skill/handoff-html/scripts/borrador",
        );
        const html = join(dir, "plan.html");
        await Bun.write(html, "<title>Desde T3</title>v1");
        const credencial = join(dir, "t3code.json");
        await Bun.write(
            credencial,
            JSON.stringify({ baseUrl: t3.url.origin, accessToken: "t3-token" }),
        );
        const stateHome = join(dir, "state");
        async function publish(...flags: string[]) {
            const proc = Bun.spawn(
                ["bash", script, "publish", ...flags, html],
                {
                    cwd: dir,
                    env: {
                        ...process.env,
                        BORRADOR_URL: server.url.origin,
                        BORRADOR_APP_URL: server.url.origin,
                        BORRADOR_TOKEN: clave,
                        BORRADOR_HARNESS: "t3code",
                        T3CODE_CREDENTIAL_FILE: credencial,
                        XDG_STATE_HOME: stateHome,
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
            const r = await publish();
            expect(r.exitCode, r.stderr).toBe(0);
            // Sin bridge corriendo, avisa pero publica igual.
            expect(r.stderr).toContain("bridge");
            const { url } = JSON.parse(r.stdout);
            const id = url.split("/").at(-1);
            const plan = (await api("GET", "/planes")).json.find(
                (p: any) => p.id === id,
            );
            expect(plan).toMatchObject({
                harness: "t3code",
                sesionId: "t-activo",
                sesionTitulo: "Plan del repo",
                sesionUrl: `${t3.url.origin}/env-1/t-activo`,
            });
            const sesiones = Array.from(
                new Bun.Glob("borrador/sessions/*/sesion.json").scanSync(
                    stateHome,
                ),
            );
            expect(sesiones).toHaveLength(1);
            const sesionJson = await Bun.file(
                join(stateHome, sesiones[0]!),
            ).json();
            expect(sesionJson).toMatchObject({
                baseUrl: server.url.origin,
                harness: "t3code",
                sessionId: "t-activo",
                planId: id,
                estado: "vigilando",
            });
            // Con dos threads activos en el repo hay que elegir.
            threads[1]!.activo = true;
            const ambiguo = await publish();
            expect(ambiguo.exitCode).toBe(1);
            expect(ambiguo.stderr).toContain("varios threads");
            const explicito = await publish("--session-id", "t-quieto");
            expect(explicito.exitCode, explicito.stderr).toBe(0);
            expect(JSON.parse(explicito.stdout).version).toBe(1);
        } finally {
            server.stop(true);
            t3.stop(true);
            await rm(dir, { recursive: true, force: true });
        }
    }, 15000);
});

describe("eventos", () => {
    test("el browser recibe version_nueva cuando el agente publica", async () => {
        const id = await planNuevo();
        await api("POST", `/planes/${id}/acciones`, { tipo: "refine" });
        const ctrl = new AbortController();
        const res = await app.handle(
            new Request("http://test/api/planes/eventos", {
                headers: { authorization: `Bearer ${clave}` },
                signal: ctrl.signal,
            }),
        );
        expect(res.status).toBe(200);
        // En `app.handle` los chunks del stream llegan como string, no como bytes.
        const lector = res.body!.getReader();
        expect(String((await lector.read()).value)).toContain(
            "event: conectado",
        );
        await api("POST", `/planes/${id}/versiones`, {
            contenidoHtml: "<title>t</title><section id='a'>v2</section>",
            sesion,
        });
        const { value } = await lector.read();
        const chunk = String(value);
        expect(chunk).toContain("event: version_nueva");
        expect(chunk).toContain(id);
        await api("POST", `/planes/${id}/acciones`, { tipo: "implement" });
        await api("POST", `/planes/${id}/acciones/rebotar`, { sesion });
        expect(String((await lector.read()).value)).toContain(
            "event: accion_rebotada",
        );
        ctrl.abort();
    });
});
