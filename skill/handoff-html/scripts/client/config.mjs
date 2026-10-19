import { mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readOptional, writeJson } from './state.mjs';

const configDir = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'borrador');
export async function loadConfig({ envToken = true } = {}) {
    const json = await readOptional(join(configDir(), 'config.json'));
    const saved = json ? JSON.parse(json) : {};
    const baseUrl = process.env.BORRADOR_URL || saved.url || (await readOptional(join(configDir(), 'url')))?.trim();
    return {
        baseUrl: baseUrl?.replace(/\/$/, ''),
        appUrl: (process.env.BORRADOR_APP_URL || saved.appUrl || baseUrl)?.replace(/\/$/, ''),
        token: (envToken && process.env.BORRADOR_TOKEN) || saved.token || (await readOptional(join(configDir(), 'token')))?.trim(),
    };
}
export async function configure(args) {
    if (!args.length || args.length % 2) throw new Error('Uso: borrador config --url <api> [--app-url <visor>] [--token <token>]');
    const path = join(configDir(), 'config.json');
    const saved = JSON.parse(await readOptional(path) || '{}');
    for (let i = 0; i < args.length; i += 2) {
        const key = { '--url': 'url', '--app-url': 'appUrl', '--token': 'token' }[args[i]];
        if (!key) throw new Error(`Opción desconocida: ${args[i]}`);
        if (key !== 'token' && !['http:', 'https:'].includes(new URL(args[i + 1]).protocol)) throw new Error('La URL debe usar http o https');
        saved[key] = args[i + 1];
    }
    await mkdir(configDir(), { recursive: true });
    await writeJson(path, saved);
    if (saved.token) await rm(join(configDir(), 'token'), { force: true });
    if (process.env.BORRADOR_TOKEN && process.env.BORRADOR_TOKEN !== saved.token)
        console.error('borrador: aviso: BORRADOR_TOKEN tiene prioridad sobre el token guardado; quitá esa variable para usar config.json');
    console.log(JSON.stringify({ configured: true, file: path }));
}
