// El bridge contra un Borrador y un T3 falsos: entrega, rebote e implement.
// Corre con: node --test skill/handoff-html/scripts/bridge
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

let dir;
let borradorUrl;
let t3Url;
// Estado del Borrador falso: qué devuelve `siguiente` y qué recibió.
const borrador = { accion: null, rebotes: [], polls: 0, espera: null };
// Estado del T3 falso: el thread y los mensajes que le llegaron.
const t3 = { thread: null, mensajes: [], fallos: 0, onDispatch: null };

function servir(handler) {
    return new Promise((resolve) => {
        const server = createServer(async (req, res) => {
            let body = "";
            for await (const chunk of req) body += chunk;
            const payload = req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')
                ? Object.fromEntries(new URLSearchParams(body)) : body ? JSON.parse(body) : null;
            const r = await handler(req, payload);
            res.writeHead(r.status ?? 200, { "content-type": "application/json" });
            res.end(r.body === undefined ? "" : JSON.stringify(r.body));
        });
        server.listen(0, "127.0.0.1", () => resolve(server));
    });
}

let servidores;
let bridge;
before(async () => {
    dir = await mkdtemp(join(tmpdir(), "bridge-test-"));
    process.env.XDG_STATE_HOME = dir;
    process.env.BORRADOR_TOKEN = "token-borrador";
    process.env.T3CODE_CREDENTIAL_FILE = join(dir, "t3code.json");
    const sBorrador = await servir(async (req, body) => {
        const url = new URL(req.url, "http://x");
        assert.equal(req.headers.authorization, "Bearer token-borrador");
        if (url.pathname.endsWith("/acciones/siguiente")) {
            borrador.polls++;
            await borrador.espera;
            assert.equal(url.searchParams.get("harness"), "t3code");
            assert.equal(url.searchParams.get("id"), "thread-1");
            if (!borrador.accion) return { status: 204 };
            return { body: borrador.accion };
        }
        if (url.pathname.endsWith("/acciones/rebotar")) {
            borrador.rebotes.push(body);
            borrador.accion = null;
            return { status: 204 };
        }
        return { status: 404, body: "?" };
    });
    const sT3 = await servir(async (req, body) => {
        if (req.url === '/oauth/token') {
            assert.equal(body.subject_token, 'pair-test');
            assert.equal(body.scope, 'orchestration:read orchestration:operate');
            return { body: { access_token: 'token-t3', expires_in: 3600, scope: body.scope } };
        }
        assert.equal(req.headers.authorization, "Bearer token-t3");
        if (req.url === "/api/orchestration/shell")
            return { body: { projects: [], threads: t3.thread ? [t3.thread] : [] } };
        if (req.url === "/api/orchestration/dispatch") {
            if (t3.fallos-- > 0) return { status: 503, body: 'temporal' };
            await t3.onDispatch?.();
            t3.mensajes.push(body);
            return { body: { sequence: t3.mensajes.length } };
        }
        return { status: 404, body: "?" };
    });
    servidores = [sBorrador, sT3];
    borradorUrl = `http://127.0.0.1:${sBorrador.address().port}`;
    t3Url = `http://127.0.0.1:${sT3.address().port}`;
    await writeFile(
        process.env.T3CODE_CREDENTIAL_FILE,
        JSON.stringify({ baseUrl: t3Url, accessToken: "token-t3" }),
    );
    bridge = await import("./bridge.mjs");
    bridge.config.stateHome = join(dir, "borrador");
    bridge.config.pollWaitS = 0;
    bridge.config.retryMs = 50;
    bridge.config.log = () => { };
});

after(async () => {
    for (const s of servidores) s.close();
    await rm(dir, { recursive: true, force: true });
});

let sesionDir;
beforeEach(async () => {
    borrador.accion = null;
    borrador.rebotes = [];
    borrador.polls = 0;
    borrador.espera = null;
    t3.mensajes = [];
    t3.fallos = 0;
    t3.onDispatch = null;
    bridge.config.giveUpMs = 60 * 60_000;
    t3.thread = {
        id: "thread-1",
        title: "Plan del repo",
        archivedAt: null,
        runtimeMode: "full-access",
        interactionMode: "default",
        session: { activeTurnId: null },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
    };
    // Cada test arranca sin sesiones de los anteriores.
    await rm(join(bridge.config.stateHome, "sessions"), { recursive: true, force: true });
    sesionDir = join(bridge.config.stateHome, "sessions", `s-${Date.now()}-${Math.random()}`);
    await mkdir(sesionDir, { recursive: true });
    await writeFile(join(sesionDir, "plan.html"), "<title>Mi plan</title>hola");
    await writeFile(
        join(sesionDir, "sesion.json"),
        JSON.stringify({
            baseUrl: borradorUrl,
            appUrl: borradorUrl,
            harness: "t3code",
            sessionId: "thread-1",
            sessionTitle: "Plan del repo",
            planId: "11111111-2222-3333-4444-555555555555",
            htmlCopy: join(sesionDir, "plan.html"),
            estado: "vigilando",
        }),
    );
});

test('pair guarda la credencial privada y devuelve solo metadata', async () => {
    const { pair } = await import('./t3code.mjs');
    const result = await pair(`${t3Url}/#token=pair-test`);
    assert.equal(result.paired, true);
    assert.ok(!JSON.stringify(result).includes('token-t3'));
    assert.equal((await stat(result.credentialFile)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(result.credentialFile)).accessToken, 'token-t3');
});

test('reintenta un rechazo temporal de T3 y entrega la acción', async () => {
    borrador.accion = { tipo: 'refine', comentarios: [] };
    t3.fallos = 1;
    await bridge.vigilar(sesionDir);
    assert.equal(t3.mensajes.length, 1);
    assert.equal(borrador.polls, 2);
    assert.equal((await leerSesion()).estado, 'entregado');
});

test('deja el fallo en la sesión cuando vence el plazo de entrega', async () => {
    borrador.accion = { tipo: 'refine', comentarios: [] };
    t3.fallos = 1;
    bridge.config.giveUpMs = 0;
    await bridge.vigilar(sesionDir);
    assert.equal((await leerSesion()).estado, 'fallido');
    assert.match((await leerSesion()).error, /503/);
    assert.equal(t3.mensajes.length, 0);
});

test('una publicación durante la entrega queda vigilando', async () => {
    borrador.accion = { tipo: 'refine', comentarios: [] };
    t3.onDispatch = async () => {
        await writeFile(join(sesionDir, 'sesion.json'), JSON.stringify({
            ...await leerSesion(), publicationId: 'nueva-publicacion', estado: 'vigilando',
        }));
    };
    await bridge.vigilar(sesionDir);
    assert.equal(t3.mensajes.length, 1);
    assert.equal((await leerSesion()).estado, 'vigilando');
    assert.equal((await leerSesion()).publicationId, 'nueva-publicacion');
});

test('cerrar el bridge cancela un long-poll pendiente sin perder la sesión', { timeout: 2000 }, async () => {
    let release;
    borrador.espera = new Promise(resolve => { release = resolve; });
    const ctrl = new AbortController();
    const tarea = bridge.run({ signal: ctrl.signal });
    try {
        while (!borrador.polls) await new Promise(resolve => setTimeout(resolve, 5));
        ctrl.abort();
        await tarea;
        assert.equal((await leerSesion()).estado, 'vigilando');
    } finally {
        ctrl.abort();
        release();
        await tarea;
    }
});

const leerSesion = async () => JSON.parse(await readFile(join(sesionDir, "sesion.json"), "utf8"));

test("refine: manda al thread la referencia a la skill y el JSON de wait, y queda entregado", async () => {
    borrador.accion = {
        tipo: "refine",
        comentarios: [{ bloqueId: "a", fragmento: "hola", texto: "más corto" }],
    };
    await bridge.vigilar(sesionDir);
    assert.equal(t3.mensajes.length, 1);
    const msg = t3.mensajes[0];
    assert.equal(msg.type, "thread.turn.start");
    assert.equal(msg.threadId, "thread-1");
    assert.equal(msg.runtimeMode, "full-access");
    assert.match(msg.message.text, /handoff-html/);
    assert.match(msg.message.text, /borrador wait/);
    const json = JSON.parse(msg.message.text.match(/```json\n(.*)\n```/s)[1]);
    assert.deepEqual(json, { ...borrador.accion, archivo: join(sesionDir, "plan.html") });
    assert.equal((await leerSesion()).estado, "entregado");
    assert.equal(borrador.rebotes.length, 0);
    await assert.rejects(stat(join(sesionDir, "approved")));
});

test("thread ocupado: rebota la acción y sigue vigilando sin mandar nada", async () => {
    borrador.accion = { tipo: "refine", comentarios: [] };
    t3.thread.session.activeTurnId = "turno-en-curso";
    const ctrl = new AbortController();
    const tarea = bridge.vigilar(sesionDir, { signal: ctrl.signal });
    // El rebote vacía la acción en el falso; el bridge vuelve a pollear y ve 204.
    while (borrador.rebotes.length === 0) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 60));
    ctrl.abort();
    await tarea;
    assert.deepEqual(borrador.rebotes[0], { sesion: { harness: "t3code", id: "thread-1" } });
    assert.equal(t3.mensajes.length, 0);
    assert.equal((await leerSesion()).estado, "vigilando");
    assert.ok(borrador.polls >= 2);
});

test("esperando aprobación en T3 también cuenta como ocupado", async () => {
    borrador.accion = { tipo: "implement", comentarios: [] };
    t3.thread.hasPendingApprovals = true;
    const ctrl = new AbortController();
    const tarea = bridge.vigilar(sesionDir, { signal: ctrl.signal });
    while (borrador.rebotes.length === 0) await new Promise((r) => setTimeout(r, 10));
    ctrl.abort();
    await tarea;
    assert.equal(t3.mensajes.length, 0);
});

test("implement: entrega, marca approved para que el próximo publish abra un plan nuevo", async () => {
    borrador.accion = { tipo: "implement", comentarios: [{ bloqueId: null, fragmento: null, texto: "dale" }] };
    await bridge.vigilar(sesionDir);
    assert.equal(t3.mensajes.length, 1);
    assert.equal((await leerSesion()).approved, true);
    const s = await leerSesion();
    assert.equal(s.estado, "entregado");
    assert.equal(s.entregado, "implement");
});

test("thread archivado o inexistente: falla explícito y deja el error en sesion.json", async () => {
    borrador.accion = { tipo: "refine", comentarios: [] };
    t3.thread = null;
    await bridge.vigilar(sesionDir);
    const s = await leerSesion();
    assert.equal(s.estado, "fallido");
    assert.match(s.error, /ya no existe/);
    assert.equal(t3.mensajes.length, 0);
});

test("escanear arranca un vigilante por sesión en `vigilando` y ignora el resto", async () => {
    const otro = join(bridge.config.stateHome, "sessions", "otro");
    await mkdir(otro, { recursive: true });
    await writeFile(join(otro, "sesion.json"), JSON.stringify({ harness: "t3code", estado: "entregado" }));
    const claude = join(bridge.config.stateHome, "sessions", "claude");
    await mkdir(claude, { recursive: true });
    // Las sesiones de Claude Code no son vigiladas por el bridge.
    borrador.accion = { tipo: "refine", comentarios: [] };
    await bridge.escanear();
    // Da tiempo al vigilante a entregar.
    for (let i = 0; i < 100 && t3.mensajes.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(t3.mensajes.length, 1);
    assert.equal((await leerSesion()).estado, "entregado");
});
