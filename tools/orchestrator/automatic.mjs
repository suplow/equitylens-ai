import { Manager, gitSnapshot, inspectPreflight } from './core.mjs';
function queueState(tasks) {
  if (tasks.every(t => t.state === 'ACCEPTED')) return 'READY_FOR_REVIEW';
  return tasks.find(t => ['FAILED', 'WAITING_FOR_QUOTA'].includes(t.state))?.state || 'RUNNING';
}

// Extends the existing transactional store and single-worktree execution lock.
// No new approval is inferred from restart, an absent response, or a worker message.
export class AutomaticManager extends Manager {
  canApproveProgram() {
    return !this.state.program && !this.busy && this.state.tasks.every(t => t.state === 'PLANNED' ||
      (t.state === 'BLOCKED' && !t.workerPid && !t.tests.length && this.state.events.some(e => e.code === 'MANUAL_HANDOFF' && e.task === t.id))) &&
      this.state.phases.every(p => ['PLANNED', 'APPROVED', 'BLOCKED'].includes(p.state));
  }
  view() { return { ...super.view(), canApproveProgram: this.canApproveProgram() }; }
  constructor(root, plan, options = {}) {
    super(root, plan, options); this.reviewer = options.reviewer; this.advancing = false;
    if (this.state.program?.enabled) {
      const uncertain = this.state.tasks.some(t => ['UNKNOWN', 'RUNNING', 'VERIFYING'].includes(t.state));
      if (uncertain) this.block('Interrupted execution needs operator reconciliation');
      else {
        // Only an explicitly enabled program may recover an idle queue. Stop/pause
        // disable it durably before the process exits.
        this.mutate(() => {
          this.state.stopped = false;
          for (const p of this.state.phases) if (p.state === 'PAUSED') p.state = queueState(this.state.tasks.filter(t => t.phaseId === p.id));
          this.event('PROGRAM_IDLE_RECOVERY');
        });
      }
    }
  }
  approveProgram(confirmation) {
    if (confirmation !== `APPROVE PROGRAM ${this.state.planHash}`) throw Error('Explicit program confirmation required');
    if (!this.worker || !this.reviewer) throw Error('Codex writer and independent reviewer must be configured');
    if (!this.canApproveProgram()) throw Error('Program approval requires planned tasks or an unused manual handoff');
    const baseline = gitSnapshot(this.root);
    if (baseline.files.length || !baseline.branch) throw Error('Program approval requires clean committed branch');
    this.mutate(() => {
      this.state.program = { planHash: this.state.planHash, enabled: true, approvedAt: this.clock(), baseline: baseline.fingerprint, error: null, manualHandoffArchive: structuredClone(this.state.tasks.filter(t => t.state === 'BLOCKED')) };
      for (const p of this.state.phases) { p.state = 'PLANNED'; p.error = null; }
      for (const t of this.state.tasks) if (t.state === 'BLOCKED') {
        t.errorHistory.push({ at: this.clock(), code: 'OWNER_SUPERSEDED_UNUSED_MANUAL_HANDOFF' });
        t.state = 'PLANNED'; t.attempts = 0; t.checkpoint = null; t.workerRunId = null;
      }
      this.state.stopped = false; this.event('OWNER_APPROVED_PROGRAM');
    });
  }
  resumeProgram() {
    if (!this.state.program || !this.worker || !this.reviewer) throw Error('Approved program and adapters required');
    if (this.busy || this.advancing || this.state.tasks.some(t => ['UNKNOWN', 'RUNNING', 'VERIFYING', 'BLOCKED'].includes(t.state))) throw Error('Active or unknown/blocked outcome requires reconciliation');
    if (gitSnapshot(this.root).files.length) throw Error('Resume requires clean Git');
    this.mutate(() => {
      this.state.program.enabled = true; this.state.program.error = null; this.state.stopped = false;
      for (const p of this.state.phases) if (p.state === 'PAUSED') p.state = queueState(this.state.tasks.filter(t => t.phaseId === p.id));
      this.event('OWNER_RESUMED_PROGRAM');
    });
  }
  block(reason) {
    this.mutate(() => {
      this.state.program.enabled = false; this.state.program.error = reason; this.state.stopped = true;
      const p = this.state.phases.find(p => p.state !== 'ACCEPTED');
      if (p) { p.state = 'BLOCKED'; p.error = reason; }
      this.event('PROGRAM_BLOCKED');
    });
  }
  async tick() {
    if (!this.state.program) return super.tick();
    if (!this.state.program.enabled || this.state.stopped || this.busy || this.advancing || this.closed) return;
    this.advancing = true;
    try {
      if (!this.worker || !this.reviewer || this.state.program.planHash !== this.state.planHash) return this.block('Approved plan or adapters unavailable');
      const p = this.state.phases.find(p => p.state !== 'ACCEPTED'); if (!p) return;
      const task = this.state.tasks.find(t => t.phaseId === p.id && t.state !== 'ACCEPTED');
      if (!task) { this.accept(p.id); return; }
      if (p.state === 'PLANNED') {
        const current = gitSnapshot(this.root);
        const last = this.state.tasks.filter(t => t.state === 'ACCEPTED').at(-1);
        if (current.fingerprint !== (last?.review?.fingerprint || this.state.program.baseline)) return this.block('Git changed before phase activation');
        this.approve(p.id); this.start(p.id);
      }
      if (['UNKNOWN', 'BLOCKED'].includes(task.state) || p.state === 'BLOCKED') return this.block(p.error || 'Unsafe execution state');
      if (['FAILED', 'WAITING_FOR_QUOTA'].includes(task.state)) {
        if (task.notBefore > this.clock()) return;
        if (task.attempts >= 1 + this.spec(task.id).maxRetries) return this.block('Retry budget exhausted');
        const check = inspectPreflight(this.root, this.state, this.plan, task.id);
        if (task.state === 'WAITING_FOR_QUOTA' && check.git.fingerprint !== task.checkpoint.before.fingerprint) return this.block('Quota interrupted work changed Git; manual reconciliation required');
        if (!check.ok || task.checkpoint?.scopeValid === false) return this.block('Repair requires unchanged clean Git and valid scope');
        this.mutate(() => { task.checkpoint.repairContext = { error: p.error, tests: task.tests }; });
        this.resume(p.id);
      }
      if (task.state === 'READY_FOR_REVIEW') {
        const before = gitSnapshot(this.root);
        if (before.fingerprint !== task.checkpoint.after.fingerprint) return this.block('Git changed after QA');
        this.busy = true;
        this.mutate(() => { task.state = 'VERIFYING'; if (p.state !== 'PAUSED') p.state = 'VERIFYING'; task.checkpoint.writerRunId = task.workerRunId; this.event('INDEPENDENT_REVIEW_STARTED', task.id); });
        let result;
        try { result = await this.reviewer({ ...this.spec(task.id), baseCommit: task.checkpoint.origin?.commit || task.checkpoint.before.commit, tests: task.tests }, { root: this.root, onPid: pid => this.mutate(() => { task.workerPid = pid; }), onRunId: id => this.mutate(() => { task.workerRunId = id; }) }); }
        catch { result = { outcome: 'unknown' }; }
        this.mutate(() => {
          if (result.outcome !== 'unknown') task.workerPid = null;
          task.state = result.outcome === 'completed' ? 'READY_FOR_REVIEW' : 'UNKNOWN';
          task.checkpoint.reviewerRunId = result.runId || null;
        });
        if (result.outcome !== 'completed' || !result.runId || result.runId === task.checkpoint.writerRunId || before.fingerprint !== gitSnapshot(this.root).fingerprint) return this.block('Independent review outcome uncertain or Git changed');
        if (!result.verdict || typeof result.verdict.approved !== 'boolean' || typeof result.verdict.note !== 'string' || !result.verdict.note.trim()) return this.block('Reviewer response is invalid');
        if (result.verdict.approved) this.review(task.id, `Codex reviewer ${result.runId}: ${result.verdict.note}`);
        else this.mutate(() => { task.state = 'FAILED'; if (p.state !== 'PAUSED') p.state = 'FAILED'; p.error = result.verdict.note.slice(0, 2000); task.errorHistory.push({ at: this.clock(), code: 'REVIEW_REJECTED' }); });
        return;
      }
      await super.tick();
    } catch (error) { this.block(error.message); }
    finally { this.advancing = false; this.busy = false; }
  }
}
