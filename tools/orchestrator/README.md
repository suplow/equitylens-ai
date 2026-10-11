# EquityLens local project orchestrator

## Windows setup and operation

Requirements: existing EquityLens checkout, Git, Node **24+** with `node:sqlite`, and `npm ci`. Tested on Windows / Node 25.2.1. No new package, paid service, database service, login automation or Windows scheduled service is installed.

```powershell
cd "C:\Users\khoa\Documents\Codex\2026-10-09\h-y\outputs\equitylens-ai"
npm run orchestrator
```

Open **http://127.0.0.1:4310**. The dashboard is separate from the financial app at port 3000. Alternative port: `npm run orchestrator -- --port=4311`. Bind is fixed to loopback; do not expose it via a proxy/tunnel or LAN.

Default is **manual worker mode**. Starting this server never approves or starts a phase. The roadmap includes a required Phase 2.1 report: its absence blocks P3-1. Phase 2.1 remains unfinished at the implementation baseline.

1. Read `project/ROADMAP.md` and each task's scope/acceptance/tests in the dashboard.
2. The **project owner** clicks Approve phase and types `APPROVE P3`. Approval is recorded against the current plan hash; it does not launch work.
3. Click **Start Approved Phase**. The scheduler verifies a clean worktree, identity, required inputs and dependencies. In manual mode the task becomes a handoff, with objective, files, acceptance criteria, required tests and current commit shown.
4. Give that task packet to the existing ChatGPT/Codex workflow. Only one writing session should work in this worktree; do not start another writer yourself. Commit scoped work on the working branch after checks. Do not approve/accept from the implementation worker.
5. **Submit manual handoff** with its full commit SHA. The orchestrator independently runs the allowlisted npm checks, recording actual exit codes. Missing/failed checks cannot pass. If you commit after testing, use **Run QA again** before review.
6. Obtain an independent review and **Record independent review**, describing its evidence. This permits the next dependent task within the same approved phase. The local owner is responsible for reviewer identity; the dashboard cannot authenticate that a note came from a separate human.
7. When all tasks have been reviewed and the final worktree is clean, **Accept outcome** and type `ACCEPT P3`. Phase 4 still needs a separate approval. No deploy, paid service, destructive migration, permissions expansion or trading is implied by phase approval. These actions are not implemented by the orchestrator.

Pause and Stop prevent new dispatch. They **drain** the active worker/QA; they do not kill processes. Pause survives completion and review. Resume explicitly re-enables scheduling. Closing with Ctrl+C stops scheduling and waits for active work before exiting. If the worker hangs, inspect its exact PID and descendants in Windows Task Manager; ending it is an operator decision, followed by UNKNOWN reconciliation. No broad process-name kill exists.

Do not edit generated STATE/TASKS/APPROVALS exports to change workflow. The phase plan is `tools/orchestrator/plan.json`; editing it after initialization invalidates the stored plan hash and refuses startup. There is deliberately no automatic migration or approval carry-over. Preserve the SQLite database and review a migration explicitly before changing an approved plan.

## Supported execution interface and experimental adapter

OpenAI documents [`codex exec --json`](https://learn.chatgpt.com/docs/non-interactive-mode) for non-interactive execution and structured progress, and [CLI options](https://learn.chatgpt.com/docs/cli/reference). Local help on this machine also exposes `exec`, `--json`, `--sandbox`, `--ignore-user-config` and exact-session `resume`. We do not use Desktop GUI automation or `resume --last`. The initial implementation starts a fresh, bounded task packet after an operator-authorized retry; it records CLI thread IDs but does not blindly replay a prior session.

Optional opt-in, using the absolute **native codex.exe** path from `Get-Command codex`:

```powershell
npm run orchestrator -- --codex=C:/absolute/path/to/codex.exe
```

This checks `codex login status` for ChatGPT authentication and rejects an API-key login, uncertain authentication, non-native Windows shim or missing executable. It passes no API key/provider override, ignores user config, uses workspace-write and never bypasses sandbox or approvals. Access and quotas depend on the user's existing plan; no promise of unlimited/free model usage is made.

**Manual mode is the validated operating mode. The CLI adapter is experimental:** no real generation, real quota exhaustion, malicious-worker isolation or all-descendant termination has been demonstrated. The installed third-party Auto Resume is a separate recovery system; do not enable it on these worker sessions. Establish one recovery owner before using CLI mode. The adapter does not modify that utility's global settings.

Approval gates protect the normal control path, not against malicious code running as the same Windows user. SQLite is in Git metadata (normally protected by Codex workspace sandbox), but unrestricted same-user programs and QA scripts can alter files or call localhost. Scope checking is detection, not a sandbox. QA runs repository scripts with local permissions. For untrusted tasks use manual review or add OS-level isolated workers and QA before autonomous use.

## Recovery guide

Runtime state: `git rev-parse --absolute-git-dir`, then `equitylens-orchestrator/state.sqlite`. SQLite transactions use WAL and FULL synchronous writes. Back up using SQLite backup tooling while live, or copy the whole directory only after orderly shutdown; copying only a live main database can lose WAL transactions. No reset/delete-state button is provided.

`project/STATE.json`, `TASKS.json`, `APPROVALS.json`, `CHECKPOINT.md` are individually atomic readable exports. A crash can leave different export revisions; SQLite remains authoritative and regenerates them. They do not override Git. Do not put secrets in task/review notes. Raw CLI output and provider error messages are drained without persistence.

| Situation | Behavior and operator action |
| --- | --- |
| Restart during worker/QA | Active task becomes UNKNOWN. Scheduler is stopped. Inspect Git, worker PID **and descendants**; never press retry merely because the manager died. |
| Dead/expired execution lock | A live PID always blocks; elapsed time is irrelevant. A dead manager may be replaced, but unresolved task outcomes remain UNKNOWN. PID reuse conservatively blocks. |
| Repeated Resume/duplicate delivery | Live lock, busy state, task state and revision guard prevent a second managed dispatch. |
| UNKNOWN | Confirm all prior worker descendants ended, inspect/commit changes and independent evidence, then Reconcile with current clean Git fingerprint. The task becomes FAILED, requiring explicit Resume within the retry budget. |
| Quota code observed | WAITING_FOR_QUOTA and a minimum 60-minute cooldown. No usage/login polling. After the cooldown, the owner may Resume if capacity is actually available. Retry budgets remain bounded. |
| Unrecognized/nonzero CLI outcome | UNKNOWN, not an invented quota timer or success. No automatic resend. |
| Failed tests | FAILED with actual test codes; fix in-scope work, rerun QA, obtain independent review. No skipped assertion is treated as a pass. |
| External Git edits | Dirty preflight blocks dispatch. Changes during QA invalidate verification. Changed branch or reviewed fingerprint prevents acceptance. Same-user edits during an active worker cannot be attributed automatically. |
| Corrupt state / changed plan | Fail closed. Preserve files, inspect backup/migration; never delete state to get a green dashboard. |

The latest 200 events and task error/checkpoint histories are retained. This is not immutable audit storage. A non-terminating worker intentionally holds progress until inspected; no timeout pretends that descendants have safely stopped.

## Verification

```powershell
npm run test:orchestrator
npm run test:orchestrator:browser
npm run lint
npm run typecheck
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Simulation tests create disposable Git repositories in Windows TEMP. They use no model calls and no market data. Browser checks run only a SIM phase. Financial app regression tests remain separate; this module contains no financial formulas needing new numerical fixtures.

No Windows Task Scheduler job is required or installed. Run in a terminal while supervising. Unattended startup is deliberately deferred until lifecycle isolation and recovery ownership have been demonstrated.
