import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readSession, writeSession } from './state.mjs';
const exec = promisify(execFile);

test('config persiste URLs y token sin imprimirlo, y respeta overrides', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'borrador-config-'));
    try {
        const env = { ...process.env, XDG_CONFIG_HOME: dir, BORRADOR_URL: '', BORRADOR_APP_URL: '', BORRADOR_TOKEN: '' };
        const { stdout } = await exec(process.execPath, [fileURLToPath(new URL('./borrador.mjs', import.meta.url)), 'config', '--url', 'http://api.test', '--app-url', 'http://viewer.test', '--token', 'test-secret'], { env });
        assert.ok(!stdout.includes('test-secret'));
        const file = join(dir, 'borrador/config.json');
        assert.equal((await stat(file)).mode & 0o777, 0o600);
        const code = `import { loadConfig } from ${JSON.stringify(new URL('./config.mjs', import.meta.url).href)}; console.log(JSON.stringify(await loadConfig()))`;
        const saved = JSON.parse((await exec(process.execPath, ['--input-type=module', '-e', code], { env })).stdout);
        assert.deepEqual(saved, { baseUrl: 'http://api.test', appUrl: 'http://viewer.test', token: 'test-secret' });
        const override = JSON.parse((await exec(process.execPath, ['--input-type=module', '-e', code], { env: { ...env, BORRADOR_URL: 'http://other.test' } })).stdout);
        assert.equal(override.baseUrl, 'http://other.test');
    } finally { await rm(dir, { recursive: true, force: true }); }
});

test('migra plan y aprobación anteriores a un solo JSON sin perderlos', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'borrador-state-'));
    try {
        await writeFile(join(dir, 'plan_id'), 'plan-1\n');
        await writeFile(join(dir, 'approved'), '');
        const old = await readSession(dir);
        assert.equal(old.planId, 'plan-1');
        assert.equal(old.approved, true);
        await writeSession(dir, old);
        assert.equal((await readSession(dir)).approved, true);
        assert.equal(JSON.parse(await readFile(join(dir, 'sesion.json'))).planId, 'plan-1');
        await assert.rejects(stat(join(dir, 'plan_id')), { code: 'ENOENT' });
        await assert.rejects(stat(join(dir, 'approved')), { code: 'ENOENT' });
    } finally { await rm(dir, { recursive: true, force: true }); }
});
