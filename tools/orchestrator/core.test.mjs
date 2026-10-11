import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Manager, gitSnapshot } from './core.mjs';

function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'equity-orchestrator-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init'); git('config', 'user.email', 'test@localhost'); git('config', 'user.name', 'Test');
  writeFileSync(join(root, 'file.txt'), 'baseline'); git('add', '.'); git('commit', '-m', 'baseline');
  const plan = { version: 1, phases: [{ id: 'SIM', title: 'Simulation', dependencies: [], tasks: [{ id: 'SIM-1', objective: 'Harmless check', inputs: [], dependencies: [], files: ['file.txt'], acceptance: ['Independent check succeeds'], tests: ['simulation'], maxRetries: 1 }] }] };
  const manager = new Manager(root, plan, { qa: async () => [{ name: 'simulation', code: 0 }], ...options });
  t.after(() => { manager.close(); rmSync(root, { recursive: true, force: true }); });
  return { manager, root, git, plan };
}
test('approval is mandatory; approval does not start a phase', t => {
  const { manager: m } = fixture(t);
  assert.throws(() => m.start('SIM'), /approval/i);
  m.approve('SIM'); assert.equal(m.view().phases[0].state, 'APPROVED');
  assert.equal(m.view().tasks[0].attempts, 0);
});
test('one manager per worktree; elapsed time never steals a live lock', t => {
  const { manager: m, root, plan } = fixture(t);
  assert.throws(() => new Manager(root, plan), /lock/i);
  assert.equal(m.view().tasks[0].state, 'PLANNED');
});
test('duplicate dispatch and resume do not duplicate a running worker', async t => {
  let finish; let calls = 0;
  const { manager: m } = fixture(t, { worker: async () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  m.approve('SIM'); m.start('SIM'); const pending = m.tick();
  await m.tick(); assert.throws(() => m.resume('SIM'), /running/i); assert.equal(calls, 1);
  finish({ outcome: 'completed', runId: 'simulated' }); await pending;
  assert.equal(m.view().tasks[0].state, 'READY_FOR_REVIEW');
  assert.throws(() => m.accept('SIM'), /review/i);
  m.review('SIM-1', 'Independent reviewer checked output'); m.accept('SIM');
  assert.equal(m.view().phases[0].state, 'ACCEPTED');
});
test('failed QA never reaches ready for review', async t => {
  const { manager: m } = fixture(t, { worker: async () => ({ outcome: 'completed' }), qa: async () => [{ name: 'simulation', code: 1 }] });
  m.approve('SIM'); m.start('SIM'); await m.tick();
  assert.equal(m.view().tasks[0].state, 'FAILED');
  assert.throws(() => m.accept('SIM'));
});

test('uncommitted output stays recoverable until scoped work is committed and reverified', async t => {
  let qaCalls = 0;
  const { manager: m, root, git } = fixture(t, {
    worker: async () => { writeFileSync(join(root, 'file.txt'), 'scoped implementation'); return { outcome: 'completed' }; },
    qa: async () => { qaCalls++; return [{ name: 'simulation', code: 0 }]; },
  });
  m.approve('SIM'); m.start('SIM'); await m.tick();
  assert.equal(m.view().tasks[0].state, 'FAILED');
  assert.equal(qaCalls, 0, 'do not run project scripts before the implementation is committed');
  assert.throws(() => m.review('SIM-1', 'Review must not accept dirty output'), /review/i);
  assert.throws(() => m.accept('SIM'), /review/i);
  git('add', 'file.txt'); git('commit', '-m', 'scoped implementation');
  await m.reverify('SIM-1');
  assert.equal(qaCalls, 1);
  assert.equal(m.view().tasks[0].state, 'READY_FOR_REVIEW');
  m.review('SIM-1', 'Independent review of committed output'); m.accept('SIM');
  assert.equal(m.view().phases[0].state, 'ACCEPTED');
});

test('a committed rename into scope still rejects the out-of-scope source deletion', async t => {
  let qaCalls = 0;
  const { manager: m, git } = fixture(t, {
    worker: async () => { git('mv', 'outside.txt', 'file.txt'); git('commit', '-m', 'rename into task scope'); return { outcome: 'completed' }; },
    qa: async () => { qaCalls++; return [{ name: 'simulation', code: 0 }]; },
  });
  git('mv', 'file.txt', 'outside.txt'); git('commit', '-m', 'out-of-scope source baseline');
  m.approve('SIM'); m.start('SIM'); await m.tick();
  assert.equal(qaCalls, 0, 'renaming an outside source must not authorize its deletion');
  assert.equal(m.view().tasks[0].state, 'FAILED');
});

test('Git snapshots retain both paths of a staged rename', t => {
  const { root, git } = fixture(t);
  git('mv', 'file.txt', 'outside.txt'); git('commit', '-m', 'out-of-scope source baseline');
  git('mv', 'outside.txt', 'file.txt');
  const snapshot = gitSnapshot(root);
  assert.deepEqual(snapshot.files.map(file => file.path).sort(), ['file.txt', 'outside.txt']);
  assert.equal(snapshot.files.find(file => file.path === 'outside.txt').digest, 'deleted');
});
test('unknown crash is not retried and survives restart', async t => {
  const { manager: m, root, plan } = fixture(t, { worker: async () => { throw Error('crash'); } });
  m.approve('SIM'); m.start('SIM'); await m.tick(); m.close();
  const next = new Manager(root, plan);
  assert.equal(next.view().tasks[0].state, 'UNKNOWN');
  assert.throws(() => next.resume('SIM'), /unknown/i);
  next.close();
});
test('quota is persisted with cooldown; repeated resume cannot bypass it', async t => {
  let now = 1000;
  const { manager: m } = fixture(t, { clock: () => now, worker: async () => ({ outcome: 'quota', runId: 'quota-fixture' }) });
  m.approve('SIM'); m.start('SIM'); await m.tick();
  assert.equal(m.view().phases[0].state, 'WAITING_FOR_QUOTA');
  assert.throws(() => m.resume('SIM'), /cooldown/i);
  now += 3600001; m.resume('SIM'); await m.tick();
  now += 3600001; assert.throws(() => m.resume('SIM'), /retry/i);
});
test('external uncommitted edits block dispatch; edits after review invalidate acceptance', async t => {
  const { manager: m, root } = fixture(t, { worker: async () => ({ outcome: 'completed' }) });
  m.approve('SIM'); m.start('SIM'); writeFileSync(join(root, 'file.txt'), 'external edit');
  await m.tick(); assert.equal(m.view().phases[0].state, 'BLOCKED');
  assert.equal(m.view().tasks[0].attempts, 0);
});
test('pause and stop prevent new dispatch', async t => {
  let calls = 0;
  const { manager: m } = fixture(t, { worker: async () => { calls++; return { outcome: 'completed' }; } });
  m.approve('SIM'); m.start('SIM'); m.pause('SIM'); await m.tick();
  assert.equal(calls, 0); m.resume('SIM'); m.stop(); await m.tick(); assert.equal(calls, 0);
});
test('pause during work survives completion, QA and independent review', async t => {
  let finish;
  const { manager: m } = fixture(t, { worker: async () => new Promise(resolve => { finish = resolve; }) });
  m.approve('SIM'); m.start('SIM'); const pending = m.tick(); m.pause('SIM');
  finish({ outcome: 'completed' }); await pending;
  assert.equal(m.view().phases[0].state, 'PAUSED');
  m.review('SIM-1', 'Independent review');
  assert.equal(m.view().phases[0].state, 'PAUSED');
});
