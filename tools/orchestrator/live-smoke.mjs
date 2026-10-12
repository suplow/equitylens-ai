// Explicitly invoked demonstration only. Never loads the real project plan/state.
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { AutomaticManager } from './automatic.mjs';
import { codexWorker } from './worker.mjs';

const executable = process.argv[2];
if (!executable) throw Error('Pass an absolute native Codex executable; uses existing ChatGPT sign-in');
const root = mkdtempSync(join(tmpdir(), 'equity-codex-smoke-'));
const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim();
git('init'); git('config', 'user.name', 'EquityLens Smoke'); git('config', 'user.email', 'smoke@localhost');
writeFileSync(join(root, 'smoke.txt'), 'pending\n'); git('add', 'smoke.txt'); git('commit', '-m', 'fixture baseline');
const plan = { version: 1, phases: [{ id: 'SMOKE', title: 'Isolated live demonstration', dependencies: [], tasks: [{ id: 'SMOKE-1', objective: 'Replace smoke.txt contents with exactly: verified followed by one newline. This is an isolated fixture, not a real project phase. Commit the change if sandbox permits.', inputs: ['smoke.txt'], dependencies: [], files: ['smoke.txt'], acceptance: ['smoke.txt contains exactly verified followed by newline'], tests: ['simulation'], maxRetries: 0 }] }] };
const options = { worker: codexWorker(executable), reviewer: codexWorker(executable, { review: true }), qa: async () => [{ name: 'simulation', code: readFileSync(join(root, 'smoke.txt'), 'utf8') === 'verified\n' ? 0 : 1 }] };
let m = new AutomaticManager(root, plan, options);
try {
  console.log(JSON.stringify({ isolatedRoot: root, baseline: git('rev-parse', 'HEAD') }));
  m.approveProgram(`APPROVE PROGRAM ${m.state.planHash}`);
  for (let step = 0; step < 5; step++) {
    await m.tick(); console.log(JSON.stringify({ step, tasks: m.state.tasks.map(t => ({ state: t.state, attempts: t.attempts, tests: t.tests, runId: t.workerRunId })), error: m.state.program.error }));
    if (!m.state.program.enabled || m.state.phases.every(p => p.state === 'ACCEPTED')) break;
    if (step === 0) { m.close(); m = new AutomaticManager(root, plan, options); console.log('Restarted between worker and independent review'); }
  }
  const result = { root, commit: git('rev-parse', 'HEAD'), state: m.state };
  writeFileSync(join(m.identity.gitDir, 'smoke-result.json'), JSON.stringify(result, null, 2));
  process.exitCode = m.phase('SMOKE').state === 'ACCEPTED' ? 0 : 1;
} finally { m.close(); }
