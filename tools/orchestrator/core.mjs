import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, writeFileSync, renameSync, readFileSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Plan, Snapshot } from './schema.mjs';

export const hash = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
export function alive(pid) { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } }
function git(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe', windowsHide: true, timeout: 15000, maxBuffer: 2 ** 20 }).trim(); }
function identity(root) {
  const top = realpathSync(git(root, 'rev-parse', '--show-toplevel'));
  const gitDir = realpathSync(git(root, 'rev-parse', '--absolute-git-dir'));
  let remote = ''; try { remote = git(root, 'remote', 'get-url', 'origin'); } catch { /* Local simulation repos have no remote. */ }
  // A remote may contain embedded credentials; persist only its identity digest.
  return { root: top, gitDir, remote: hash(remote) };
}
const exportFiles = new Set(['project/STATE.json', 'project/TASKS.json', 'project/APPROVALS.json', 'project/CHECKPOINT.md']);
export function gitSnapshot(root) {
  const branch = git(root, 'branch', '--show-current'); const commit = git(root, 'rev-parse', 'HEAD');
  // -z preserves arbitrary filenames; only exact generated snapshot paths are excluded.
  const raw = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf8', windowsHide: true });
  const entries = raw.split('\0').filter(Boolean); const files = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]; const name = entry.slice(3);
    if (entry[0] === 'R' || entry[0] === 'C' || entry[1] === 'R' || entry[1] === 'C') i++;
    if (exportFiles.has(name)) continue;
    let content = 'deleted'; const path = join(root, name);
    if (existsSync(path)) { const stat = lstatSync(path); content = stat.isFile() ? hash(readFileSync(path)) : 'non-file'; }
    files.push({ path: name, status: entry.slice(0, 2), digest: content });
  }
  return { branch, commit, files, fingerprint: hash({ branch, commit, files }) };
}
function atomic(path, value) { const temp = `${path}.${randomUUID()}.tmp`; writeFileSync(temp, value); renameSync(temp, path); }

export class Manager {
  constructor(root, plan, { clock = Date.now, worker = null, qa = null } = {}) {
    this.plan = Plan.parse(plan); this.clock = clock; this.worker = worker; this.qa = qa;
    this.identity = identity(root); this.root = this.identity.root; this.owner = randomUUID(); this.busy = false; this.closed = false;
    // Per-worktree Git directory is outside worker writable source files and shared by all launch paths.
    const dir = join(this.identity.gitDir, 'equitylens-orchestrator'); mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(join(dir, 'state.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS lock(id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, pid INTEGER NOT NULL)');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const held = this.db.prepare('SELECT * FROM lock WHERE id=1').get();
      if (held && alive(held.pid)) throw Error('Execution lock is held; elapsed time never permits stealing it');
      const row = this.db.prepare('SELECT body FROM state WHERE id=1').get();
      if (row) {
        this.state = Snapshot.parse(JSON.parse(row.body));
        if (hash(this.identity) !== hash(this.state.identity)) throw Error('Repository identity changed');
        if (hash(this.plan) !== this.state.planHash) throw Error('Plan changed: review and migrate state manually; old approvals cannot be reused');
        for (const task of this.state.tasks) if (['RUNNING', 'VERIFYING'].includes(task.state)) {
          task.state = 'UNKNOWN'; this.phase(task.phaseId).state = 'BLOCKED';
          this.phase(task.phaseId).error = 'Interrupted execution; operator reconciliation required';
        }
        // Restart never silently launches work, including a previously approved queue.
        this.state.stopped = true;
        for (const phase of this.state.phases) if (phase.state === 'RUNNING') phase.state = 'PAUSED';
      } else {
        this.state = {
          version: 1, planHash: hash(this.plan), identity: this.identity, revision: 0, stopped: false,
          phases: this.plan.phases.map(p => ({ id: p.id, title: p.title, state: 'PLANNED', approval: null, error: null })),
          tasks: this.plan.phases.flatMap(p => p.tasks.map(t => ({ id: t.id, phaseId: p.id, state: 'PLANNED', attempts: 0, workerRunId: null, workerPid: null, branch: null, commit: null, checkpoint: null, errorHistory: [], tests: [], review: null, notBefore: 0 }))), approvals: [], events: [],
        };
      }
      this.db.prepare('INSERT OR REPLACE INTO lock VALUES(1,?,?)').run(this.owner, process.pid);
      this.persist(); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); this.db.close(); this.closed = true; throw error; }
  }
  persist() { Snapshot.parse(this.state); this.db.prepare('INSERT OR REPLACE INTO state VALUES(1,?)').run(JSON.stringify(this.state)); }
  mutate(fn) {
    const before = structuredClone(this.state); this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.db.prepare('SELECT owner FROM lock WHERE id=1').get()?.owner !== this.owner) throw Error('Execution lock lost');
      fn(); this.state.revision++; this.persist(); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); if (hash(this.state) !== hash(before)) this.state = before; throw error; }
  }
  event(code, task = null) { this.state.events.push({ at: this.clock(), code, task }); this.state.events = this.state.events.slice(-200); }
  phase(id) { const p = this.state.phases.find(p => p.id === id); if (!p) throw Error('Unknown phase'); return p; }
  task(id) { const t = this.state.tasks.find(t => t.id === id); if (!t) throw Error('Unknown task'); return t; }
  spec(id) { return this.plan.phases.flatMap(p => p.tasks).find(t => t.id === id); }
  view() { return { ...structuredClone(this.state), plan: this.plan, git: gitSnapshot(this.root), busy: this.busy, adapter: this.worker ? 'configured' : 'manual' }; }
  approve(id) {
    this.mutate(() => {
      const p = this.phase(id); if (p.state !== 'PLANNED') throw Error('Only a planned phase can be approved');
      const spec = this.plan.phases.find(p => p.id === id);
      if (spec.dependencies.some(d => this.phase(d).state !== 'ACCEPTED')) throw Error('Previous phase must be accepted');
      p.approval = this.state.planHash; p.state = 'APPROVED';
      const baseline = gitSnapshot(this.root);
      for (const task of this.state.tasks.filter(t => t.phaseId === id)) { task.branch = baseline.branch; task.commit = baseline.commit; }
      this.state.approvals.push({ phaseId: id, action: 'BEGIN', planHash: this.state.planHash, at: this.clock() }); this.event('OWNER_APPROVED', id);
    });
  }
  start(id) {
    this.mutate(() => {
      const p = this.phase(id);
      if (p.approval !== this.state.planHash || p.state !== 'APPROVED') throw Error('Explicit owner approval required');
      if (this.state.phases.some(x => ['RUNNING', 'VERIFYING'].includes(x.state))) throw Error('Another phase is running');
      p.state = 'RUNNING'; this.state.stopped = false; this.event('STARTED', id);
    });
  }
  pause(id) { this.mutate(() => { const p = this.phase(id); if (!['RUNNING', 'VERIFYING'].includes(p.state)) throw Error('Phase is not running'); p.state = 'PAUSED'; this.event('PAUSED', id); }); }
  stop() { this.mutate(() => { this.state.stopped = true; for (const p of this.state.phases) if (['RUNNING', 'VERIFYING'].includes(p.state)) p.state = 'PAUSED'; this.event('STOPPED_NO_NEW_WORK'); }); }
  resume(id) {
    this.mutate(() => {
      const p = this.phase(id); const tasks = this.state.tasks.filter(t => t.phaseId === id);
      if (p.approval !== this.state.planHash) throw Error('Explicit owner approval required');
      if (this.busy || tasks.some(t => ['RUNNING', 'VERIFYING'].includes(t.state))) throw Error('Worker is still running');
      if (tasks.some(t => t.state === 'UNKNOWN')) throw Error('Unknown outcome: reconcile manually before resume');
      if (tasks.some(t => t.state === 'BLOCKED')) throw Error('Manual handoff or reconciliation required');
      if (tasks.some(t => t.notBefore > this.clock())) throw Error('Quota cooldown has not elapsed');
      if (tasks.some(t => ['FAILED', 'WAITING_FOR_QUOTA'].includes(t.state) && t.attempts >= 1 + this.spec(t.id).maxRetries)) throw Error('Retry budget exhausted');
      if (!['PAUSED', 'BLOCKED', 'FAILED', 'WAITING_FOR_QUOTA'].includes(p.state)) throw Error('Phase cannot resume from this state');
      for (const t of tasks) if (['FAILED', 'WAITING_FOR_QUOTA'].includes(t.state)) t.state = 'PLANNED';
      p.state = tasks.every(t => t.state === 'ACCEPTED') ? 'READY_FOR_REVIEW' : 'RUNNING'; p.error = null; this.state.stopped = false; this.event('RESUMED', id);
    });
  }
  async tick() {
    if (this.busy || this.state.stopped || this.closed) return;
    const phase = this.state.phases.find(p => p.state === 'RUNNING'); if (!phase) return;
    const task = this.state.tasks.find(t => t.phaseId === phase.id && t.state === 'PLANNED' && this.spec(t.id).dependencies.every(d => this.task(d).state === 'ACCEPTED'));
    if (!task) return;
    this.busy = true;
    try {
      const before = gitSnapshot(this.root); const spec = this.spec(task.id);
      const checkpoint = task.checkpoint?.after || task.checkpoint?.before;
      const prior = this.state.tasks.filter(t => t.phaseId === phase.id && t.state === 'ACCEPTED').at(-1);
      const expectedCommit = checkpoint?.commit || prior?.checkpoint?.after?.commit || task.commit;
      const invalidInput = spec.inputs.some(path => {
        const full = resolve(this.root, path);
        return !existsSync(full) || !realpathSync(full).startsWith(`${this.root}${process.platform === 'win32' ? '\\' : '/'}`);
      });
      if (hash(identity(this.root)) !== hash(this.identity) || !before.branch || before.branch !== task.branch || before.commit !== expectedCommit || before.files.length || invalidInput) {
        this.mutate(() => { phase.state = 'BLOCKED'; phase.error = 'Repository identity, clean Git state, branch or required inputs failed preflight'; this.event('PREFLIGHT_BLOCKED', task.id); }); return;
      }
      this.mutate(() => {
        task.state = this.worker ? 'RUNNING' : 'BLOCKED'; task.attempts++; task.workerRunId = randomUUID(); task.branch = before.branch; task.commit = before.commit;
        task.checkpoint = { before, after: null, at: this.clock() }; task.tests = []; task.review = null;
        if (!this.worker) { phase.state = 'BLOCKED'; phase.error = 'Manual worker: perform task in the approved scope, then submit handoff'; }
        this.event(this.worker ? 'DISPATCHED' : 'MANUAL_HANDOFF', task.id);
      });
      if (!this.worker) return;
      let result;
      try {
        result = await this.worker(spec, { root: this.root, runId: task.workerRunId, onPid: pid => this.mutate(() => { task.workerPid = pid; }), onRunId: id => this.mutate(() => { task.workerRunId = id; }) });
      } catch { result = { outcome: 'unknown' }; }
      this.mutate(() => {
        if (result.outcome !== 'unknown') task.workerPid = null;
        task.checkpoint.after = gitSnapshot(this.root);
        if (result.runId) task.workerRunId = result.runId;
        if (result.outcome === 'completed') { task.state = 'VERIFYING'; if (phase.state !== 'PAUSED') phase.state = 'VERIFYING'; }
        else {
          task.state = result.outcome === 'quota' ? 'WAITING_FOR_QUOTA' : 'UNKNOWN';
          if (task.state === 'WAITING_FOR_QUOTA') task.notBefore = this.clock() + 3600000;
          if (phase.state !== 'PAUSED') phase.state = task.state === 'UNKNOWN' ? 'BLOCKED' : task.state;
          phase.error = task.state === 'UNKNOWN' ? 'Outcome uncertain; automatic redispatch prohibited' : 'Observed quota response; wait at least one hour, then operator resume';
          task.errorHistory.push({ at: this.clock(), code: task.state }); this.event(task.state, task.id);
        }
      });
      if (task.state === 'VERIFYING') await this.verify(task.id);
    } finally { this.busy = false; }
  }
  async verify(id) {
    const task = this.task(id); const phase = this.phase(task.phaseId); const before = gitSnapshot(this.root);
    let tests = [];
    const files = [...before.files.map(f => f.path), ...git(this.root, 'diff', '--name-only', task.checkpoint.before.commit, 'HEAD').split('\n').filter(Boolean)];
    const scope = this.spec(id).files;
    const scopeValid = files.every(path => scope.some(allowed => path === allowed || path.startsWith(`${allowed}/`))) && before.branch === task.branch;
    try { if (scopeValid && this.qa) tests = await this.qa(this.spec(id).tests, this.root); } catch { tests = [{ name: 'qa-runner', code: null }]; }
    const after = gitSnapshot(this.root);
    this.mutate(() => {
      task.tests = tests; task.checkpoint.after = after; task.commit = after.commit;
      const required = this.spec(id).tests;
      const valid = scopeValid && required.every(name => tests.some(t => t.name === name && t.code === 0)) && tests.every(t => t.code === 0) && before.fingerprint === after.fingerprint && after.branch === task.branch;
      task.state = valid ? 'READY_FOR_REVIEW' : 'FAILED'; if (phase.state !== 'PAUSED') phase.state = valid ? 'READY_FOR_REVIEW' : 'FAILED';
      phase.error = valid ? null : 'QA failed, absent, or Git changed during verification'; this.event(task.state, id);
    });
  }
  async handoff(id, confirmedCommit) {
    const task = this.task(id); if (this.busy || task.state !== 'BLOCKED' || this.worker) throw Error('No manual handoff available');
    const current = gitSnapshot(this.root); if (current.commit !== confirmedCommit || current.branch !== task.branch) throw Error('Handoff commit/branch mismatch');
    this.busy = true;
    try { this.mutate(() => { task.state = 'VERIFYING'; }); await this.verify(id); } finally { this.busy = false; }
  }
  async reverify(id) {
    const task = this.task(id);
    if (this.busy || !['READY_FOR_REVIEW', 'FAILED'].includes(task.state)) throw Error('Task cannot be reverified');
    this.busy = true;
    try { this.mutate(() => { task.state = 'VERIFYING'; task.review = null; }); await this.verify(id); } finally { this.busy = false; }
  }
  reconcile(id, confirmedFingerprint) {
    this.mutate(() => {
      const task = this.task(id); if (task.state !== 'UNKNOWN' || this.busy || alive(task.workerPid)) throw Error('Cannot reconcile an active or non-unknown worker');
      const current = gitSnapshot(this.root); if (current.fingerprint !== confirmedFingerprint || current.files.length) throw Error('Reconciliation requires confirmed clean Git fingerprint');
      task.checkpoint.after = current; task.state = 'FAILED'; task.workerPid = null;
      this.phase(task.phaseId).state = 'FAILED'; this.event('OWNER_CONFIRMED_WORKER_ENDED', id);
    });
  }
  review(id, note) {
    this.mutate(() => {
      const t = this.task(id); if (t.state !== 'READY_FOR_REVIEW' || !note?.trim()) throw Error('Independent review note required');
      const current = gitSnapshot(this.root); if (current.fingerprint !== t.checkpoint.after.fingerprint) throw Error('Git changed since tests; rerun QA');
      t.review = { note: note.slice(0, 2000), fingerprint: current.fingerprint }; t.state = 'ACCEPTED';
      const p = this.phase(t.phaseId); if (p.state !== 'PAUSED') p.state = this.state.tasks.filter(x => x.phaseId === t.phaseId).every(x => x.state === 'ACCEPTED') ? 'READY_FOR_REVIEW' : 'RUNNING';
      this.event('INDEPENDENT_REVIEW_RECORDED', id);
    });
  }
  accept(id) {
    this.mutate(() => {
      const p = this.phase(id); const tasks = this.state.tasks.filter(t => t.phaseId === id);
      if (p.state !== 'READY_FOR_REVIEW' || tasks.some(t => t.state !== 'ACCEPTED' || !t.review)) throw Error('Independent review of every task is required');
      const current = gitSnapshot(this.root); const last = tasks.at(-1);
      if (current.fingerprint !== last.review.fingerprint || current.files.length) throw Error('Acceptance requires clean committed Git matching final review');
      p.state = 'ACCEPTED'; this.state.approvals.push({ phaseId: id, action: 'ACCEPT', planHash: this.state.planHash, at: this.clock() }); this.event('OWNER_ACCEPTED', id);
    });
  }
  export() {
    const dir = join(this.root, 'project'); mkdirSync(dir, { recursive: true }); const s = this.view();
    atomic(join(dir, 'STATE.json'), JSON.stringify({ version: 1, revision: s.revision, planHash: s.planHash, stopped: s.stopped, phases: s.phases }, null, 2) + '\n');
    atomic(join(dir, 'TASKS.json'), JSON.stringify(s.tasks.map(t => ({ ...this.spec(t.id), ...t })), null, 2) + '\n');
    atomic(join(dir, 'APPROVALS.json'), JSON.stringify(s.approvals, null, 2) + '\n');
    atomic(join(dir, 'CHECKPOINT.md'), `# Checkpoint\n\nSQLite is authoritative for orchestration; Git is authoritative for code.\nRevision: ${s.revision}\nBranch: ${s.git.branch}\nCommit: ${s.git.commit}\n\n${s.tasks.map(t => `- ${t.id}: ${t.state}; run ${t.workerRunId ?? 'none'}`).join('\n')}\n`);
  }
  close() { if (!this.closed) { this.db.prepare('DELETE FROM lock WHERE owner=?').run(this.owner); this.db.close(); this.closed = true; } }
}
