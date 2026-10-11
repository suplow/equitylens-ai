import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { Manager } from './core.mjs';
import { Plan } from './schema.mjs';
import { workerEnv } from './worker.mjs';
import { createDashboard } from './server.mjs';

const plan = { version: 1, phases: [{ id: 'SIM', title: 'Simulation', dependencies: [], tasks: [{ id: 'SIM-1', objective: 'No side effects', inputs: [], dependencies: [], files: ['file.txt'], acceptance: ['Check output'], tests: ['simulation'], maxRetries: 1 }] }] };
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'equity-orchestrator-integration-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init'); git('config', 'user.email', 'test@localhost'); git('config', 'user.name', 'Test');
  writeFileSync(join(root, 'file.txt'), 'fixture'); git('add', '.'); git('commit', '-m', 'fixture'); return { root, git };
}
test('real process holds lock, forced termination recovers UNKNOWN without duplicate dispatch', async () => {
  const { root } = repo(); let manager;
  const child = spawn(process.execPath, [new URL('./process-fixture.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), root, JSON.stringify(plan)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  try {
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw Error('Fixture exited early'); })]);
    assert.throws(() => new Manager(root, plan), /lock/i);
    const ended = once(child, 'exit'); child.kill(); await ended;
    manager = new Manager(root, plan); assert.equal(manager.view().tasks[0].state, 'UNKNOWN');
    await manager.tick(); assert.equal(manager.view().tasks[0].attempts, 1);
    assert.throws(() => manager.resume('SIM'), /unknown/i);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill(); manager?.close(); rmSync(root, { recursive: true, force: true }); }
});
test('HTTP origin, session, revision and owner confirmation gates', async () => {
  const { root } = repo(); const manager = new Manager(root, plan); const app = createDashboard(manager, { port: 0 });
  await app.listen(); const url = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const first = await fetch(url); const cookie = first.headers.get('set-cookie').split(';')[0];
    assert.match(first.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    const post = (body, extra = {}) => fetch(`${url}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url, Cookie: cookie, ...extra }, body: JSON.stringify(body) });
    assert.equal((await fetch(`${url}/api/state`)).status, 403);
    assert.equal((await fetch(`${url}/api/state`, { headers: { Cookie: `equity_owner=${'é'.repeat(64)}` } })).status, 403);
    assert.equal((await post({ action: 'approve', id: 'SIM', revision: 0, confirmation: 'APPROVE SIM' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post({ action: 'approve', id: 'SIM', revision: 0 })).status, 400);
    assert.equal((await post({ action: 'approve', id: 'SIM', revision: 0, confirmation: 'APPROVE SIM' })).status, 200);
    assert.equal((await post({ action: 'start', id: 'SIM', revision: 0 })).status, 409);
    assert.equal(manager.view().tasks[0].attempts, 0);
    assert.equal((await post({ action: 'start', id: 'SIM', revision: manager.state.revision })).status, 200);
    await manager.tick(); assert.equal(manager.view().tasks[0].state, 'BLOCKED');
    assert.equal((await post({ action: 'stop', revision: manager.state.revision })).status, 200);
    assert.equal(manager.view().stopped, true);
  } finally { await new Promise(resolve => app.server.close(resolve)); manager.close(); rmSync(root, { recursive: true, force: true }); }
});
test('changed plan invalidates persisted approvals instead of resetting state', () => {
  const { root } = repo(); const manager = new Manager(root, plan); manager.approve('SIM'); manager.close();
  try { const changed = structuredClone(plan); changed.phases[0].tasks[0].objective = 'New scope'; assert.throws(() => new Manager(root, changed), /Plan changed/); }
  finally { rmSync(root, { recursive: true, force: true }); }
});
test('untrusted paths, cycles, duplicate task IDs and command names fail validation', () => {
  for (const edit of [p => { p.phases[0].tasks[0].files = ['../escape']; }, p => { p.phases[0].tasks[0].tests = ['rm -rf']; }, p => { p.phases[0].tasks.push(p.phases[0].tasks[0]); }, p => { p.phases[0].tasks[0].dependencies = ['SIM-1']; }]) {
    const bad = structuredClone(plan); edit(bad); assert.equal(Plan.safeParse(bad).success, false);
  }
  const env = workerEnv({ PATH: 'ok', OPENAI_API_KEY: 'secret', CODEX_API_KEY: 'secret', OPENAI_BASE_URL: 'evil', OWNER_TOKEN: 'secret' }); assert.deepEqual(env, { PATH: 'ok' });
});
test('changes outside task scope fail QA before invoking project scripts', async () => {
  const { root } = repo(); let qaCalls = 0;
  const manager = new Manager(root, plan, { worker: async () => { writeFileSync(join(root, 'outside.txt'), 'bad'); return { outcome: 'completed' }; }, qa: async () => { qaCalls++; return [{ name: 'simulation', code: 0 }]; } });
  try { manager.approve('SIM'); manager.start('SIM'); await manager.tick(); assert.equal(qaCalls, 0); assert.equal(manager.view().tasks[0].state, 'FAILED'); }
  finally { manager.close(); rmSync(root, { recursive: true, force: true }); }
});
test('external committed edits and branch changes require reconciliation before dispatch', async () => {
  for (const change of ['commit', 'branch']) {
    const { root, git } = repo(); const manager = new Manager(root, plan);
    try {
      manager.approve('SIM'); manager.start('SIM');
      if (change === 'branch') git('checkout', '-b', 'external');
      else { writeFileSync(join(root, 'file.txt'), 'external commit'); git('add', '.'); git('commit', '-m', 'external'); }
      await manager.tick(); assert.equal(manager.view().phases[0].state, 'BLOCKED'); assert.equal(manager.view().tasks[0].attempts, 0);
    } finally { manager.close(); rmSync(root, { recursive: true, force: true }); }
  }
});
