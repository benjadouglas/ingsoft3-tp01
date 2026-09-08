// Adaptador HTTP de T3: credenciales, identidad de conversación y entrega.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { writeJson } from '../client/state.mjs';
import { checked } from '../client/api.mjs';

const credentialFile = () => process.env.T3CODE_CREDENTIAL_FILE || join(homedir(), '.config/borrador/t3code.json');
export class CredentialError extends Error {}

export async function loadCredential() {
    try {
        const credential = JSON.parse(await readFile(credentialFile(), 'utf8'));
        if (!credential.baseUrl || !credential.accessToken) throw new Error('credencial inválida');
        if (credential.expiresAt && Date.now() >= Date.parse(credential.expiresAt)) throw new Error('credencial vencida');
        return credential;
    } catch (error) {
        throw new CredentialError(`T3 Code: ${error.message}. Corré borrador bridge pair <link>.`);
    }
}

export async function pair(pairingUrl) {
    const url = new URL(pairingUrl);
    const token = new URLSearchParams(url.hash.slice(1)).get('token');
    if (!token) throw new Error('El link de pairing no contiene #token=...');
    const baseUrl = url.origin;
    const result = await checked(await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            subject_token: token,
            subject_token_type: 'urn:t3:params:oauth:token-type:environment-bootstrap',
            requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            scope: 'orchestration:read orchestration:operate',
            client_label: 'Borrador bridge',
            client_device_type: 'bot',
        }),
    }));
    const expiresAt = new Date(Date.now() + Number(result.expires_in) * 1000).toISOString();
    const file = credentialFile();
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeJson(file, { baseUrl, accessToken: result.access_token, scopes: result.scope, expiresAt });
    return { paired: true, baseUrl, expiresAt, credentialFile: file };
}

async function authenticatedFetch(path, init = {}) {
    const credential = await loadCredential();
    const timeout = AbortSignal.timeout(15_000);
    const response = await fetch(`${credential.baseUrl}${path}`, {
        ...init,
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
        headers: { authorization: `Bearer ${credential.accessToken}`, ...init.headers },
    });
    if ([401, 403].includes(response.status)) throw new CredentialError('T3 rechazó la credencial. Corré borrador bridge pair <link>.');
    return checked(response);
}

function getShell(signal) {
    return authenticatedFetch('/api/orchestration/shell', { signal });
}

export async function findThread(threadId, signal) {
    return (await getShell(signal)).threads.find(t => t.id === threadId);
}

/** Identifica la conversación que publica, sin adivinar entre varios threads activos. */
export async function resolveSession(repo, id, title) {
    const shell = await getShell();
    let thread;
    if (id) {
        thread = shell.threads.find(t => t.id === id && !t.archivedAt);
        if (!thread) throw new Error(`El thread de T3 ${id} no existe o está archivado`);
    } else {
        async function normalize(path) {
            const expanded = path.replace(/^~(?=\/|$)/, homedir());
            const canonical = await realpath(expanded).catch(() => resolve(expanded));
            return canonical.replace(/\/$/, '').toLowerCase();
        }
        const root = await normalize(repo);
        const projects = new Set();
        for (const p of shell.projects) if (await normalize(p.workspaceRoot) === root) projects.add(p.id);
        const matches = shell.threads.filter(t => !t.archivedAt && projects.has(t.projectId) && t.session?.activeTurnId);
        if (matches.length !== 1) throw new Error(matches.length
            ? `Hay varios threads activos; pasá --session-id: ${matches.map(t => t.id).join(', ')}`
            : 'No encontré un thread activo para este repo; pasá --session-id');
        thread = matches[0];
    }
    const credential = await loadCredential();
    let url;
    try {
        const response = await fetch(`${credential.baseUrl}/.well-known/t3/environment`, { signal: AbortSignal.timeout(10_000) });
        if (response.ok) {
            const { environmentId } = await response.json();
            if (environmentId) url = `${credential.baseUrl}/${environmentId}/${thread.id}`;
        }
    } catch { /* El enlace es opcional; la entrega usa el id. */ }
    return { harness: 't3code', sessionId: thread.id, sessionTitle: title || thread.title || '', sessionUrl: url, sessionDir: repo };
}

export function isBusy(thread) {
    return Boolean(thread.session?.activeTurnId || thread.hasPendingApprovals || thread.hasPendingUserInput);
}

export async function sendMessage(thread, text, signal) {
    return authenticatedFetch("/api/orchestration/dispatch", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            type: "thread.turn.start",
            commandId: randomUUID(),
            threadId: thread.id,
            message: { messageId: randomUUID(), role: "user", text, attachments: [] },
            runtimeMode: thread.runtimeMode || "full-access",
            interactionMode: thread.interactionMode || "default",
            createdAt: new Date().toISOString(),
        }),
    });
}
