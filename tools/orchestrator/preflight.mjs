import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectPreflight } from './core.mjs';
import { Plan, Snapshot } from './schema.mjs';

// Read only, including when the dashboard owns the execution lock.
const root = realpathSync(resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '../..')));
const taskId = process.argv[3] || 'P3-1';
const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const db = new DatabaseSync(join(gitDir, 'equitylens-orchestrator/state.sqlite'), { readOnly: true });
let state;
try { state = Snapshot.parse(JSON.parse(db.prepare('SELECT body FROM state WHERE id=1').get().body)); }
finally { db.close(); }
const plan = Plan.parse(JSON.parse(readFileSync(join(root, 'tools/orchestrator/plan.json'), 'utf8')));
const result = inspectPreflight(root, state, plan, taskId);
console.log(JSON.stringify({ readOnly: true, phaseState: state.phases.find(p => p.id === state.tasks.find(t => t.id === taskId)?.phaseId)?.state, ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
