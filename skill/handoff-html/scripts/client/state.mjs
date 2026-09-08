import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const stateHome = () => join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'borrador');
export async function readOptional(path) {
    try { return await readFile(path, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function writeJson(path, value) {
    const tmp = `${path}.${randomUUID()}.tmp`;
    try {
        await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
        await rename(tmp, path);
    } finally { await rm(tmp, { force: true }); }
}
export function sessionDir(baseUrl, repo, harness, id) {
    const hash = createHash('sha1').update([baseUrl, repo, harness, id, ''].join('\0')).digest('hex');
    return join(stateHome(), 'sessions', hash);
}
export async function readSession(dir) {
    const json = await readOptional(join(dir, 'sesion.json'));
    const session = json ? JSON.parse(json) : {};
    // Read old installations without losing an open plan or its approval.
    const legacyId = await readOptional(join(dir, 'plan_id'));
    const legacyApproval = await readOptional(join(dir, 'approved'));
    if (!json && !legacyId) return null;
    return { ...session, planId: session.planId ?? legacyId?.trim(), approved: session.approved ?? legacyApproval !== null };
}
export async function writeSession(dir, session) {
    await mkdir(dir, { recursive: true });
    const next = { ...session, actualizadoEn: new Date().toISOString() };
    await writeJson(join(dir, 'sesion.json'), next);
    await Promise.all(['plan_id', 'approved'].map(name => rm(join(dir, name), { force: true })));
    return next;
}
