#!/usr/bin/env node
// Un long-poll por sesión T3; launchd mantiene el proceso vivo entre turnos.
import { execFile } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import * as t3 from './t3code.mjs';
import { loadConfig } from '../client/config.mjs';
import { request, checked } from '../client/api.mjs';
import { stateHome, readOptional, readSession, writeSession, writeJson } from '../client/state.mjs';

const exec = promisify(execFile);
export const config = {
    stateHome: stateHome(),
    scanMs: 5_000,
    pollWaitS: 55,
    retryMs: 15_000,
    giveUpMs: 60 * 60_000,
    log: (...args) => console.log(new Date().toISOString(), ...args),
};
const sessionsDir = () => join(config.stateHome, 'sessions');
const bridgeDir = () => join(config.stateHome, 'bridge');
const estadoFile = () => join(bridgeDir(), 'estado.json');
const vigilados = new Map();
class PermanentError extends Error {}

async function escribirSesion(dir, sesion, cambios) {
    const current = await readSession(dir);
    // La entrega anterior no debe pisar una publicación nueva.
    if (current?.publicationId !== sesion.publicationId) return;
    await writeSession(dir, { ...current, ...cambios });
}

function mensajePara(sesion, accion) {
    return [
        `Borrador: el usuario actuó sobre el plan (${sesion.appUrl}/planes/${sesion.planId}).`,
        'Aplicá la skill handoff-html a esta acción, exactamente como si la hubiera devuelto `borrador wait`:',
        '```json',
        JSON.stringify({ ...accion, archivo: sesion.htmlCopy }),
        '```',
    ].join('\n');
}

export async function vigilar(dir, { signal } = {}) {
    let primerFallo;
    while (!signal?.aborted) {
        const sesion = await readSession(dir);
        if (!sesion || sesion.estado !== 'vigilando') return;
        let entregando = false;
        try {
            const api = { ...await loadConfig(), baseUrl: sesion.baseUrl };
            const path = `/api/planes/${sesion.planId}/acciones`;
            const query = new URLSearchParams({ wait: config.pollWaitS, harness: sesion.harness, id: sesion.sessionId });
            const response = await request(api, 'GET', `${path}/siguiente?${query}`, undefined, signal);
            if ([401, 403, 404].includes(response.status)) throw new PermanentError(`Borrador HTTP ${response.status}`);
            const accion = await checked(response);
            if (!accion) continue;
            entregando = true;
            const thread = await t3.findThread(sesion.sessionId, signal);
            if (!thread || thread.archivedAt) throw new PermanentError(thread ? 'El thread de T3 está archivado' : 'El thread de T3 ya no existe');
            if ((await readSession(dir))?.publicationId !== sesion.publicationId) continue;
            if (t3.isBusy(thread)) {
                const rebote = await request(api, 'POST', `${path}/rebotar`, {
                    sesion: { harness: sesion.harness, id: sesion.sessionId },
                }, signal);
                if (rebote.status !== 409) await checked(rebote);
                continue;
            }
            await t3.sendMessage(thread, mensajePara(sesion, accion), signal);
            await escribirSesion(dir, sesion, { estado: 'entregado', entregado: accion.tipo, approved: accion.tipo === 'implement', error: undefined });
            config.log(sesion.planId, 'entregado', accion.tipo);
            return;
        } catch (error) {
            if (signal?.aborted) return;
            config.log(sesion.planId, error.message);
            if (entregando) primerFallo ??= Date.now();
            if (error instanceof PermanentError || error instanceof t3.CredentialError ||
                (primerFallo !== undefined && Date.now() - primerFallo >= config.giveUpMs)) {
                await escribirSesion(dir, sesion, { estado: 'fallido', error: error.message });
                return;
            }
            await sleep(config.retryMs, undefined, { signal }).catch(error => {
                if (!signal?.aborted) throw error;
            });
        }
    }
}

// También alimenta status: los errores viven en la sesión, sin otra copia global.
async function sesiones() {
    const entries = await readdir(sessionsDir(), { withFileTypes: true }).catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return [];
    });
    const result = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = join(sessionsDir(), entry.name);
        const sesion = await readSession(dir);
        if (sesion?.harness === 't3code') result.push({ dir, ...sesion });
    }
    return result;
}

export async function escanear({ signal } = {}) {
    const planes = await sesiones();
    for (const sesion of planes) {
        if (sesion.estado !== 'vigilando' || vigilados.has(sesion.dir)) continue;
        const tarea = vigilar(sesion.dir, { signal })
            .catch(error => config.log(sesion.planId, error.message))
            .finally(() => vigilados.delete(sesion.dir));
        vigilados.set(sesion.dir, tarea);
    }
    return planes;
}

export async function run({ signal } = {}) {
    const ctrl = new AbortController();
    signal = signal ? AbortSignal.any([signal, ctrl.signal]) : ctrl.signal;
    await mkdir(bridgeDir(), { recursive: true });
    try {
        while (!signal?.aborted) {
            const planes = await escanear({ signal });
            let error = planes.find(sesion => sesion.estado === 'fallido')?.error;
            try { await t3.loadCredential(); } catch (e) { error = e.message; }
            await writeJson(estadoFile(), { pid: process.pid, actualizadoEn: new Date().toISOString(), vigilando: vigilados.size, error });
            await sleep(config.scanMs, undefined, { signal });
        }
    } catch (error) {
        if (!signal?.aborted) throw error;
    } finally {
        ctrl.abort();
        await Promise.allSettled(vigilados.values());
    }
}

const LABEL = "com.borrador.bridge";
const plistPath = () => join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);

function plist(nodePath, scriptPath) {
    const logDir = bridgeDir();
    const env = ['PATH', 'XDG_CONFIG_HOME', 'XDG_STATE_HOME', 'BORRADOR_TOKEN', 'T3CODE_CREDENTIAL_FILE']
        .filter(key => process.env[key])
        .map(key => `    <key>${key}</key><string>${escapeXml(process.env[key])}</string>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
  <string>${escapeXml(nodePath)}</string>
  <string>${escapeXml(scriptPath)}</string>
  <string>run</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${env}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${escapeXml(join(logDir, "bridge.log"))}</string>
  <key>StandardErrorPath</key><string>${escapeXml(join(logDir, "bridge.log"))}</string>
</dict>
</plist>
`;
}

function escapeXml(s) {
    return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
}

async function install() {
    if (process.platform !== "darwin") throw new Error("`install` solo sabe de launchd (macOS). En otro sistema corré `bridge run` con tu supervisor.");
    await mkdir(bridgeDir(), { recursive: true });
    await mkdir(dirname(plistPath()), { recursive: true });
    const script = fileURLToPath(import.meta.url);
    await writeFile(plistPath(), plist(process.execPath, script), { mode: 0o600 });
    await exec("launchctl", ["bootout", `gui/${process.getuid()}`, plistPath()]).catch(() => { });
    await exec("launchctl", ["bootstrap", `gui/${process.getuid()}`, plistPath()]);
    console.log(JSON.stringify({ installed: true, plist: plistPath(), log: join(bridgeDir(), "bridge.log") }));
}

async function uninstall() {
    await exec("launchctl", ["bootout", `gui/${process.getuid()}`, plistPath()]).catch(() => { });
    await rm(plistPath(), { force: true });
    console.log(JSON.stringify({ uninstalled: true }));
}

async function status() {
    const estado = JSON.parse(await readOptional(estadoFile()) || '{}');
    const edadSegundos = (Date.now() - Date.parse(estado.actualizadoEn)) / 1000;
    const planes = (await sesiones()).map(s => ({ planId: s.planId, thread: s.sessionTitle || s.sessionId, estado: s.estado, error: s.error, actualizadoEn: s.actualizadoEn }));
    console.log(JSON.stringify({ bridge: { ...estado, vivo: edadSegundos < 180, edadSegundos }, planes }, null, 2));
}

export async function cli([command, ...args]) {
    if (args.length !== (command === 'pair' ? 1 : 0)) throw new Error('Argumentos inválidos para bridge');
    switch (command) {
        case 'run': {
            const ctrl = new AbortController();
            for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => ctrl.abort());
            await run({ signal: ctrl.signal });
            break;
        }
        case 'install': await install(); break;
        case 'uninstall': await uninstall(); break;
        case 'status': await status(); break;
        case 'pair': console.log(JSON.stringify(await t3.pair(args[0]))); break;
        default: throw new Error('Uso: bridge run | install | uninstall | status | pair <pairing-url>');
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    cli(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
