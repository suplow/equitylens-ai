/* The DOM is populated only with textContent. Worker text is never HTML. */
let state;
const el = id => document.getElementById(id);
function node(tag, text, cls) { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; }
function button(parent, label, action, id, enabled = true) { const b = node('button', label); b.disabled = !enabled; b.onclick = () => act(action, id); parent.append(b); }
async function act(action, id) {
  const data = { action: state.program && action === 'resume' ? 'resumeProgram' : action, id, revision: state.revision };
  if (action === 'approveProgram') data.confirmation = el('program-confirmation').value;
  if (['approve', 'accept', 'reconcile'].includes(action)) {
    const expected = `${action.toUpperCase()} ${id}`;
    data.confirmation = prompt(`Bạn là chủ dự án. Đọc phạm vi/kiểm thử trước khi xác nhận. Nhập ${expected}`);
    if (data.confirmation !== expected) return;
  }
  if (action === 'review') { data.note = prompt('Ghi bằng chứng từ người review độc lập (không dùng lời tự đánh giá của worker):'); if (!data.note) return; }
  if (action === 'handoff') { data.commit = prompt('Nhập commit SHA đã bàn giao:'); if (!data.commit) return; }
  if (action === 'reconcile') {
    if (!confirm('Tôi đã kiểm tra worker VÀ mọi tiến trình con đều kết thúc, đã đối chiếu thay đổi Git. Không chỉ dựa vào PID đã biến mất.')) return;
    data.fingerprint = state.git.fingerprint;
  }
  try {
    const response = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json(); if (!response.ok) throw Error(result.error);
    el('message').textContent = 'Đã ghi nhận thao tác.'; await refresh();
  } catch (error) { el('message').textContent = error.message; }
}
async function refresh() {
  try {
    const response = await fetch('/api/state'); if (!response.ok) throw Error('Phiên điều khiển hết hạn; tải lại trang.'); state = await response.json();
    const accepted = state.tasks.filter(t => t.state === 'ACCEPTED').length;
    el('program-phrase').textContent = `APPROVE PROGRAM ${state.planHash}`;
    el('program-status').textContent = state.program ? `${state.program.enabled ? 'Đang bật' : 'Đã dừng'} · ${state.program.error || 'Kế hoạch đã phê duyệt'}` : 'Chưa phê duyệt kế hoạch tổng thể';
    el('approve-program').disabled = !state.canApproveProgram || state.adapter === 'manual';
    el('resume-program').disabled = !state.program || state.program.enabled || state.busy;
    el('summary').replaceChildren();
    for (const [label, value] of [['Tiến độ task', `${accepted}/${state.tasks.length} đã review`], ['Worker', state.busy ? 'Đang chạy / QA' : `${state.adapter} · idle`], ['Scheduler', state.stopped ? 'Đã dừng' : 'Chờ task được phép']]) {
      const c = node('article', '', 'card'); c.append(node('span', label, 'label'), node('strong', value)); el('summary').append(c);
    }
    el('phases').replaceChildren();
    for (const p of state.phases) {
      const card = node('article', '', 'card'); card.append(node('h3', `${p.id} · ${p.title}`), node('p', p.state, 'state'));
      if (p.error) card.append(node('p', p.error, 'error'));
      button(card, 'Approve phase', 'approve', p.id, p.state === 'PLANNED');
      button(card, 'Start Approved Phase', 'start', p.id, p.state === 'APPROVED');
      button(card, 'Pause', 'pause', p.id, ['RUNNING', 'VERIFYING'].includes(p.state));
      button(card, 'Resume', 'resume', p.id, ['PAUSED', 'BLOCKED', 'FAILED', 'WAITING_FOR_QUOTA'].includes(p.state));
      button(card, 'Accept outcome', 'accept', p.id, p.state === 'READY_FOR_REVIEW'); el('phases').append(card);
    }
    el('tasks').replaceChildren();
    for (const t of state.tasks) {
      const spec = state.plan.phases.flatMap(p => p.tasks).find(x => x.id === t.id);
      const card = node('article', '', 'task'); card.append(node('h3', `${t.id} · ${t.state}`), node('p', spec.objective));
      const detail = node('details'); detail.append(node('summary', 'Phạm vi, tiêu chí, kiểm thử & checkpoint'));
      detail.append(node('pre', JSON.stringify({ inputs: spec.inputs, dependencies: spec.dependencies, files: spec.files, acceptance: spec.acceptance, requiredTests: spec.tests, actualTests: t.tests, attempts: t.attempts, workerRunId: t.workerRunId, workerPid: t.workerPid, commit: t.commit, checkpoint: t.checkpoint, errors: t.errorHistory, quotaCooldownUntil: t.notBefore ? new Date(t.notBefore).toISOString() : null }, null, 2))); card.append(detail);
      if (t.state === 'BLOCKED') button(card, 'Submit manual handoff', 'handoff', t.id);
      if (t.state === 'UNKNOWN') button(card, 'Reconcile unknown outcome', 'reconcile', t.id);
      if (['READY_FOR_REVIEW', 'FAILED'].includes(t.state)) button(card, 'Run QA again', 'reverify', t.id);
      if (t.state === 'READY_FOR_REVIEW') button(card, 'Record independent review', 'review', t.id);
      el('tasks').append(card);
    }
    el('checkpoint').textContent = JSON.stringify({ revision: state.revision, branch: state.git.branch, latestCommit: state.git.commit, changedFiles: state.git.files.map(f => f.path), planHash: state.planHash, preflight: state.preflight }, null, 2);
    el('events').textContent = state.events.slice(-20).map(e => `${new Date(e.at).toISOString()} · ${e.code} · ${e.task || ''}`).join('\n') || 'Chưa có sự kiện. Chưa phê duyệt Phase 3–5.';
  } catch (error) { el('message').textContent = error.message; }
}
el('refresh').onclick = refresh; el('stop').onclick = () => act('stop'); refresh(); setInterval(refresh, 10000);
el('approve-program').onclick = () => act('approveProgram');
el('resume-program').onclick = () => act('resumeProgram');
