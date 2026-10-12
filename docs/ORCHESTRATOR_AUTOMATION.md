# Automatic orchestration: operating guide and verification report

## Status (2026-10-12)

Implemented on top of the existing Manager, worktree lock, SQLite store, plan and Phase 2.1 code. This is **not yet demonstrated as a working autonomous developer on this Windows installation**. Simulated orchestration and browser flows pass; the real Codex smoke task failed the independent acceptance check because Windows execution policy rejected its first file-inspection command. No real Phase 3–5 task was launched during implementation.

## What is implemented

- Existing seven tasks in `tools/orchestrator/plan.json` provide the bounded Phase 3–5 decomposition, dependencies, file scope, tests and retry limits. The worker may plan implementation steps within one task; it cannot expand the approved plan. Arbitrary AI-generated replanning is deliberately not enabled.
- `AutomaticManager` extends rather than replaces Manager. Program consent includes the immutable plan hash, time and starting Git fingerprint, stored in the same transactional SQLite snapshot.
- One explicit program approval authorizes dependent phase activation and acceptance after required QA and independent review. It does not authorize paid services, deployment, destructive work, permission expansion, trading, merge or force push.
- Writer uses supported `codex exec --json`, workspace-write sandbox, approval policy never, existing ChatGPT login, no inherited API keys and no user configuration overrides. Reviewer is a fresh Codex invocation using a read-only sandbox and a distinct run ID; it checks the actual diff and returns a validated verdict. It cannot approve its own writer session.
- Required tests run outside the writer. Failed QA or review is sent back as repair context, bounded by the task retry limit. Clean Git, branch, identity, original cumulative file scope and review fingerprint remain mandatory. Writer commits its scoped work; if the sandbox prevents commits, work remains intact and the task blocks. No automatic push from workers.
- Stop/Pause disables the program atomically and prevents new dispatch. Running work drains. Resume uses the prior explicit program approval, never creates another approval. Unknown worker/reviewer outcomes require reconciliation.
- An enabled, idle queue may resume after restarting the server; active/uncertain executions become UNKNOWN/BLOCKED. Explicit Stop/Pause survives restart. The operator must relaunch the process after Windows reboot; no persistent service is installed.
- Explicit quota codes wait at least one hour and remain bounded by retry limits. Retry is allowed only if Git is unchanged from before that attempt. Partial changes or ambiguous errors block, preserving files. This is a conservative retry, not a claim that quota availability can be queried or guaranteed.
- An unused manual handoff may be superseded only through a new explicit program approval. Prior approval records and an audit event remain. Existing completed/unknown work cannot be silently adopted.
- Dashboard includes hash-bound program confirmation, program error/status, Stop and Resume, alongside existing phase controls, QA history and checkpoints. Approval uses an HTML input, not a browser prompt.

## Activation

First resolve the local sandbox failure and successfully rerun the isolated demonstration:

```powershell
$codexExecutable = (Get-Command codex.exe).Source
node tools/orchestrator/live-smoke.mjs $codexExecutable
```

This creates an isolated temporary Git repository and uses ChatGPT subscription quota. It must finish with its SMOKE phase ACCEPTED, a real implementation commit, passing independent file check and separate Codex reviewer. It closes/reopens the Manager between implementation and review to exercise idle recovery. Failed fixtures are preserved for diagnosis; no project SQLite is used.

Then start from the integrated worktree (stop its existing server gracefully first; never run two managers against one worktree):

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run orchestrator -- --port=4311 "--codex=$codexExecutable"
```

Open `http://127.0.0.1:4311/`. Read all task scopes and conditions, copy the displayed `APPROVE PROGRAM <plan hash>` into the confirmation field, then select **Phê duyệt và chạy kế hoạch tổng thể**. This is the owner consent that starts automatic scheduling. Do not reuse the old 4310 dashboard: it has separate state. No consent was submitted by the implementation agent.

If blocked, inspect the phase error and checkpoint. Do not clear SQLite, edit approvals, reset files, force push, bypass sandbox or retry uncertain processes. Compare live Git and the worker process tree before using the existing reconciliation control. A changed plan requires a reviewed migration; this feature does not rewrite its hash to reuse consent.

## Actual verification

- Baseline: 27 existing orchestrator tests passed.
- Expanded suite: **40/40 passed**. Includes program approval, dependent phase transitions, independent review rejection and repair, bounded QA failures, duplicate ticks, Stop across restart, idle restart recovery, unknown writer/reviewer, quota cooldown, manual-handoff migration preserving approvals, external Git edits, out-of-scope work and quota after an unchecked commit. The archived manual handoff preservation assertion also passed after its final addition.
- Browser checks cover both original manual controls and new automatic approval/Stop/Resume/review/acceptance, at 390px and 1440px, using isolated SIM repositories.
- Application unit tests: 282 passed. Production build: passed, 34 generated routes. Lint and typecheck passed; both orchestrator browser suites passed. Full financial-app Playwright E2E was not rerun because application code was unchanged.
- Real CLI: version `0.162.0-alpha.2`; `login status` confirmed ChatGPT. Run `01a12c4e-8551-7651-88fc-56e5d8deb581` ended normally, but did not implement the task. Independent simulation QA returned code 1; the queue exhausted its zero-retry budget and blocked. Baseline stayed `2aa0d5557aef3e88f48ed83eb34270c332e81686`; file stayed `pending`. Evidence is preserved locally in the smoke fixture's `.git/smoke-result.json` and Codex session record, not uploaded.
- The denied command was a PowerShell file/Git inspection. A separate native sandbox diagnostic returned `helper_unknown_error: setup refresh had errors`. Existing Windows configuration selected `elevated`. No security configuration, ACL, authentication, paid service or global Git setting was changed to bypass this failure.
- Independent implementation reviewer found the unchecked-quota-commit retry bug. A regression reproduced it (attempts 2 instead of 1) before the fix. Reviewer then hit quota; **a full independent security review is not complete**.

## Remaining limitations

End-to-end real writer → commit → tests → reviewer → acceptance and real interrupted-worker recovery are not yet proven on this machine. Unknown active runs still require a human; reviewer quota currently blocks conservatively rather than automatically restarting review. No live quota exhaustion was intentionally induced. No process isolation system can be replaced by prompt instructions: the worker's workspace scope is enforced after execution, while the CLI sandbox must enforce OS access during execution. Independent model review is additional evidence, not a correctness guarantee. QA results record exit codes, not full command output. Notifications are local dashboard/event log only. New Windows services, automatic GitHub publication, arbitrary replanning and production operations are not enabled.

## Sources

- [Official iterative Codex repair workflow](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)
- [Official Windows sandbox configuration and troubleshooting](https://learn.chatgpt.com/docs/windows/windows-sandbox)
- Installed `codex exec --help` verified the JSON, ignore-user-config and sandbox flags actually used.
