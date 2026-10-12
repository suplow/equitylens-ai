import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { AutomaticManager } from './automatic.mjs';

function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'equity-auto-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init'); git('config', 'user.email', 'test@localhost'); git('config', 'user.name', 'Test');
  writeFileSync(join(root, 'fixture.txt'), 'baseline'); git('add', '.'); git('commit', '-m', 'baseline');
  const plan = { version: 1, phases: ['ONE', 'TWO'].map((id, index) => ({ id, title: id, dependencies: index ? ['ONE'] : [], tasks: [{ id: `${id}-1`, objective: 'Simulation', inputs: ['fixture.txt'], dependencies: index ? ['ONE-1'] : [], files: ['fixture.txt'], acceptance: ['Verified independently'], tests: ['simulation'], maxRetries: 1 }] })) };
  const config = { worker: async () => ({ outcome: 'completed' }), reviewer: async () => ({ outcome: 'completed', runId: 'review', verdict: { approved: true, note: 'Checked fixture independently' } }), qa: async () => [{ name: 'simulation', code: 0 }], ...options };
  const m = new AutomaticManager(root, plan, config); t.after(() => m.close());
  return { m, root, plan, config, git };
}
test('program approval is explicit; one approval completes dependent phases through independent reviews', async t => {
  const { m } = fixture(t); await m.tick(); assert.equal(m.task('ONE-1').attempts, 0);
  assert.throws(() => m.approveProgram('wrong'), /confirmation/i);
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`);
  for (let i = 0; i < 10; i++) await m.tick();
  assert.ok(m.state.phases.every(p => p.state === 'ACCEPTED'));
  assert.ok(m.state.tasks.every(task => task.attempts === 1 && task.review));
});
test('failed QA is repaired within budget, never accepted when failures persist', async t => {
  const { m } = fixture(t, { qa: async () => [{ name: 'simulation', code: 1 }] });
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`);
  for (let i = 0; i < 10; i++) await m.tick();
  assert.equal(m.task('ONE-1').attempts, 2); assert.equal(m.phase('ONE').state, 'BLOCKED');
  assert.equal(m.task('TWO-1').attempts, 0);
});
test('unknown worker never retries; external dirty files block before dispatch', async t => {
  const { m, root } = fixture(t, { worker: async () => ({ outcome: 'unknown' }) });
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`); await m.tick();
  for (let i = 0; i < 3; i++) await m.tick();
  assert.equal(m.task('ONE-1').attempts, 1); assert.equal(m.task('ONE-1').state, 'UNKNOWN');
  writeFileSync(join(root, 'outside.txt'), 'user data');
  assert.throws(() => m.resumeProgram(), /unknown|clean|blocked/i);
});
test('stop survives restart and resume never duplicates a writer', async t => {
  let finish; let calls = 0;
  const { m, root, plan, config } = fixture(t, { worker: async () => { calls++; return new Promise(r => { finish = r; }); } });
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`);
  const running = m.tick(); await m.tick(); assert.equal(calls, 1);
  m.stop(); finish({ outcome: 'completed' }); await running; m.close();
  const restarted = new AutomaticManager(root, plan, config); t.after(() => restarted.close());
  await restarted.tick(); assert.equal(calls, 1); assert.equal(restarted.state.program.enabled, false);
});
test('known quota waits for cooldown and retries within budget only', async t => {
  let now = 0; const { m } = fixture(t, { clock: () => now, worker: async () => ({ outcome: 'quota' }) });
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`); await m.tick(); await m.tick();
  assert.equal(m.task('ONE-1').attempts, 1); now = 3600001; await m.tick();
  assert.equal(m.task('ONE-1').attempts, 2); now *= 2; await m.tick();
  assert.equal(m.phase('ONE').state, 'BLOCKED');
});
test('owner can supersede unused manual handoff without deleting approval history', async t => {
  const { m, config } = fixture(t); m.worker = null; m.approve('ONE'); m.start('ONE'); await m.tick();
  const approvals = structuredClone(m.state.approvals); assert.equal(m.task('ONE-1').state, 'BLOCKED');
  m.worker = config.worker; m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`);
  assert.deepEqual(m.state.approvals, approvals); assert.equal(m.task('ONE-1').state, 'PLANNED');
  assert.equal(m.state.program.manualHandoffArchive[0].state, 'BLOCKED');
  assert.ok(m.state.program.manualHandoffArchive[0].checkpoint.before.commit);
  assert.ok(m.task('ONE-1').errorHistory.some(e => e.code === 'OWNER_SUPERSEDED_UNUSED_MANUAL_HANDOFF'));
});
test('review rejection reaches repair worker as evidence, and independent review can later pass', async t => {
  let reviews = 0; const inputs = [];
  const { m } = fixture(t, { worker: async spec => { inputs.push(spec); return { outcome: 'completed' }; }, reviewer: async () => ({ outcome: 'completed', runId: `review-${++reviews}`, verdict: { approved: reviews > 1, note: 'Missing test for boundary condition' } }) });
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`);
  for (let i = 0; i < 12; i++) await m.tick();
  assert.ok(m.state.phases.every(p => p.state === 'ACCEPTED'));
  assert.match(inputs[1].repairContext.error, /boundary/);
});
test('idle enabled program recovers across restart; source changes remain blocked', async t => {
  const { m, root, plan, config } = fixture(t);
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`); await m.tick(); m.close();
  const next = new AutomaticManager(root, plan, config); t.after(() => next.close());
  await next.tick(); assert.equal(next.task('ONE-1').state, 'ACCEPTED');
  writeFileSync(join(root, 'fixture.txt'), 'external'); await next.tick();
  assert.equal(next.phase('ONE').state, 'BLOCKED'); assert.equal(next.task('TWO-1').attempts, 0);
});
test('out of scope committed edits are never repaired or auto accepted', async t => {
  const { m, root, git } = fixture(t);
  m.worker = async () => { writeFileSync(join(root, 'outside.txt'), 'unexpected'); git('add', '.'); git('commit', '-m', 'out of scope'); return { outcome: 'completed' }; };
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`); await m.tick(); await m.tick();
  assert.equal(m.task('ONE-1').attempts, 1); assert.equal(m.phase('ONE').state, 'BLOCKED');
});
test('reviewer crash persists UNKNOWN and cannot resume automatically', async t => {
  const { m, root, plan, config } = fixture(t, { reviewer: async () => ({ outcome: 'unknown' }) });
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`); await m.tick(); await m.tick();
  assert.equal(m.task('ONE-1').state, 'UNKNOWN'); m.close();
  const next = new AutomaticManager(root, plan, config); t.after(() => next.close()); await next.tick();
  assert.equal(next.task('ONE-1').attempts, 1); assert.throws(() => next.resumeProgram(), /unknown/);
});
test('quota after any Git change blocks instead of treating an unchecked commit as baseline', async t => {
  let now = 0; const { m, root, git } = fixture(t, { clock: () => now });
  m.worker = async () => { writeFileSync(join(root, 'outside.txt'), 'unexpected'); git('add', '.'); git('commit', '-m', 'unexpected'); return { outcome: 'quota' }; };
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`); await m.tick(); now = 3600001; await m.tick();
  assert.equal(m.task('ONE-1').attempts, 1); assert.equal(m.phase('ONE').state, 'BLOCKED');
});
test('pause during independent review prevents next task and can resume after review drains', async t => {
  let finish; const { m } = fixture(t, { reviewer: async () => new Promise(r => { finish = r; }) });
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`); await m.tick(); const reviewing = m.tick();
  assert.equal(m.phase('ONE').state, 'VERIFYING'); m.pause('ONE');
  finish({ outcome: 'completed', runId: 'independent', verdict: { approved: true, note: 'Verified fixture' } }); await reviewing;
  await m.tick(); assert.equal(m.task('TWO-1').attempts, 0); assert.equal(m.phase('ONE').state, 'PAUSED');
  m.resumeProgram(); await m.tick(); assert.equal(m.phase('ONE').state, 'ACCEPTED');
});
