#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, copyFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { configure, loadConfig } from './config.mjs';
import { request, checked } from './api.mjs';
import { readOptional, readSession, writeSession, sessionDir, stateHome } from './state.mjs';
import { resolveSession } from '../bridge/t3code.mjs';

async function identity(repo, flags) {
    const env = process.env;
    const harness = flags['--harness'] || env.BORRADOR_HARNESS;
    if (harness && !['claude', 'claude-code', 't3code'].includes(harness)) throw new Error('Harness no soportado; usá claude-code o t3code');
    const t3 = harness === 't3code' || (!harness && (env.__CFBundleIdentifier?.startsWith('com.t3tools.') || env.T3CODE_PROJECT_ROOT));
    if (t3) return resolveSession(repo, flags['--session-id'], flags['--session-title']);
    const session = {
        harness: 'claude-code',
        sessionId: flags['--session-id'] || env.CLAUDE_CODE_SESSION_ID,
        sessionTitle: flags['--session-title'] || '',
        sessionDir: repo,
    };
    if (!session.sessionId) throw new Error('No se pudo identificar la sesión; pasá --harness y --session-id');
    const projects = join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects');
    const dirs = await readdir(projects).catch(() => []);
    for (const dir of dirs) {
        const log = await readOptional(join(projects, dir, `${session.sessionId}.jsonl`));
        if (!log) continue;
        const records = log.trim().split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
        session.sessionTitle = flags['--session-title'] || records.findLast(r => r.type === 'custom-title')?.customTitle || records.findLast(r => r.type === 'ai-title')?.aiTitle || '';
        session.sessionDir = records.find(r => r.cwd)?.cwd || repo;
        break;
    }
    return session;
}

async function warnBridge() {
    const text = await readOptional(join(stateHome(), 'bridge/estado.json'));
    let state;
    try { state = JSON.parse(text); } catch { /* Estado incompleto de una instalación anterior. */ }
    if (!state || Date.now() - Date.parse(state.actualizadoEn) > 180_000) {
        console.error('borrador: aviso: el bridge no está corriendo o no da señales; el plan quedó publicado. Corré borrador bridge status.');
    } else if (state.error) console.error(`borrador: aviso del bridge: ${state.error}`);
}

async function main([command, ...args]) {
    if (command === 'config') return configure(args);

    if (command === 'bridge') return (await import('../bridge/bridge.mjs')).cli(args);

    if (!['publish', 'wait'].includes(command)) throw new Error('Uso: borrador config | publish [opciones] <html> | wait [opciones] | bridge <comando>');

    const flags = {};
    while (args[0]?.startsWith('--')) {
        const key = args.shift();
        if (!['--harness', '--session-id', '--session-title'].includes(key) || !args.length) throw new Error(`Opción inválida: ${key}`);
        flags[key] = args.shift();
    }

    if (args.length !== (command === 'publish' ? 1 : 0)) throw new Error('publish requiere un archivo HTML; wait no recibe archivos');

    const config = await loadConfig();

    if (!config.baseUrl) throw new Error('Configurá la API con borrador config --url <url>');
    if (!config.token) throw new Error('Configurá BORRADOR_TOKEN o borrador config --token <token>');

    let repo;
    try {
        repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { repo = process.cwd(); }

    const session = await identity(repo, flags);
    if (command === 'wait' && session.harness === 't3code') throw new Error('En T3 Code la espera la hace el bridge');

    const dir = sessionDir(config.baseUrl, repo, session.harness, session.sessionId);
    const previous = await readSession(dir);
    const sesion = { harness: session.harness, id: session.sessionId, titulo: session.sessionTitle || undefined, directorio: session.sessionDir, url: session.sessionUrl };

    if (command === 'publish') {
        const html = await readFile(resolve(args[0]), 'utf8');
        let id = previous?.approved ? null : previous?.planId;
        let response;
        if (id) {
            response = await request(config, 'POST', `/api/planes/${id}/versiones`, { contenidoHtml: html, sesion });
            if (response.status === 404) id = null;
        }
        if (!id) response = await request(config, 'POST', '/api/planes', { proyecto: basename(repo), contenidoHtml: html, sesion });
        const result = await checked(response);
        id ||= result.id;
        await mkdir(dir, { recursive: true });
        const htmlCopy = join(dir, 'plan.html');
        if (resolve(args[0]) !== htmlCopy) await copyFile(resolve(args[0]), htmlCopy);
        await writeSession(dir, { ...session, baseUrl: config.baseUrl, appUrl: config.appUrl, repo, planId: id, htmlCopy, approved: false, publicationId: randomUUID(), estado: session.harness === 't3code' ? 'vigilando' : 'publicado' });
        if (session.harness === 't3code') await warnBridge();
        console.log(JSON.stringify({ url: `${config.appUrl}/planes/${id}`, version: result.version }));
        return;
    }
    if (!previous?.planId) throw new Error('No hay ningún plan publicado desde esta sesión; corré publish primero');
    const query = new URLSearchParams({ wait: '55', harness: session.harness, id: session.sessionId });
    for (; ;) {
        let response;
        try { response = await request(config, 'GET', `/api/planes/${previous.planId}/acciones/siguiente?${query}`); }
        catch { await sleep(3000); continue; }
        if (response.status === 204) continue;
        if (response.status >= 500) { await sleep(3000); continue; }
        const action = await checked(response);
        const htmlCopy = previous.htmlCopy || join(dir, 'plan.html');
        await writeSession(dir, { ...previous, ...session, htmlCopy, approved: action.tipo === 'implement', estado: 'entregado', entregado: action.tipo });
        console.log(JSON.stringify({ ...action, archivo: htmlCopy }));
        return;
    }
}

main(process.argv.slice(2)).catch(error => { console.error(`borrador: ${error.message}`); process.exitCode = 1; });
