# Orchestrator implementation report

## Revalidation after Phase 2.1

Revalidation completed across 2026-10-11/12 on `feature/equitylens-orchestrator-validation`, based on Phase 2.1 report commit `8cd9524`. Implementation revision: **`372834d001ce45dda8dbddbe4f835e5259d722ab`**. The original implementation below remains the architectural baseline; current findings and test results in this section supersede its old readiness status and counts.

The existing orchestrator was audited and retained rather than rebuilt. Official Codex [non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode) and [CLI/SDK/app-server integration choices](https://developers.openai.com/blog/codex-as-a-platform) were rechecked. Local `codex-cli 0.162.0-alpha.2` exposes JSONL, workspace-write and ignore-user-config. No real model task, paid API or Phase 3–5 task was launched. CLI worker mode remains experimental; manual handoff remains the validated operating mode.

### Verified defects and fixes

1. Worker JSONL could report completion despite contradictory terminal events or an incomplete trailing event. Simulated process tests failed before the fix. Conflicting outcomes, missing thread identity and truncated output now produce UNKNOWN, not success or automatic retry. Auth/environment tests also verify rejection of API-key sign-in and omission of inherited provider secrets.
2. Independent review reproduced a recovery dead end: dirty but stable worker output could pass QA and be reviewed; acceptance then required a commit, which invalidated the review with no normal reverify path. QA now requires clean committed work before and after checks. Dirty output stays FAILED and can recover via commit → reverify → independent review → acceptance. Regression demonstrates the complete recovery path.
3. Independent review reproduced a scope bypass via renaming an out-of-scope file into an allowed destination. Git snapshots now retain both rename paths; committed scope comparison uses NUL-delimited `--no-renames`, checking both deletion and addition. Regression proves QA is not invoked for that out-of-scope change.
4. QA stripped `PLAYWRIGHT_CHANNEL`, losing the configured Windows browser. A failing test reproduced this; QA now forwards only an explicitly selected supported channel, without forwarding provider credentials.
5. Existing E2E diagnostic screenshots wrote into tracked `qa/`, changing the Git fingerprint during QA. Captures now go to ignored `test-results/captures/`; no assertions or existing images were removed. An actual run through `qaRunner` proved all five checks exited 0 and the before/after Git fingerprint was identical.

### Actual verification

| Check | Observed result |
| --- | --- |
| `npm run test:orchestrator` | **22 passed**, 0 failed, including the new worker/recovery/rename regressions |
| `npm run test:orchestrator:browser` | PASS: Chrome SIM-only approve/start/pause/resume/stop/handoff/QA/review/accept, 390px and 1440px, no page errors |
| `npm run lint`, `npm run typecheck` | PASS; also exercised through actual `qaRunner` |
| `qaRunner`: lint, typecheck, test, build, test:e2e | Every exit code **0**; `gitUnchanged: true` |
| Separate `npm run test:e2e` | **19 passed**, 0 failed, 36.0 seconds after moving diagnostic captures |
| Independent core review checks | 12 core tests PASS; syntax checks PASS; reviewed recovery and scope fixes |

The real QA runner used the current development checkout (which already contained preserved local QA images); this proves commands and fingerprint stability, not dispatch from a dirty tree. Manager preflight/clean-tree rejection and recovery are separately tested in disposable SIM repositories. The app unit suite contains the existing Phase 2.1 independent numerical verification; no financial formula was modified in this revision.

### Current operation and limits

- Dashboard remains at `http://127.0.0.1:4310`, manual mode, with the scheduler stopped after restart. **P3/P4/P5 remain PLANNED, approvals empty, attempts zero.** No plan hash or stored approval scope was changed.
- The Phase 2.1 report now exists. Roadmap/README no longer incorrectly say its implementation is unfinished; P3-1 still requires owner approval and a readiness review.
- Existing local `qa/` image modifications are preserved outside these commits. They correctly block new task dispatch until reviewed and committed separately or a clean worktree is prepared. Runtime STATE/CHECKPOINT exports are not treated as source changes.
- No automatic live quota recovery has been demonstrated. Quota codes/cooldown/retry limits were simulated; ambiguous formats remain UNKNOWN. The separate third-party Auto Resume must not also control an experimental CLI worker session.
- Independent reviewer examined and reproduced the core issues; QA is separately executed. The dashboard review-note field still cannot authenticate an independent person's identity, and same-Windows-user code is not isolated by it.
- Stop prevents dispatch and drains active work; no guarantee of arbitrary descendant termination. No Windows service, production deployment, shared-history rewrite, purchase or Phase approval was performed.

## Original implementation record

Date: 2026-10-11. Baseline: `87eb4fdd88945a9edb8b6c5ff97dd6a50fd34bf5`.
Branch: `feature/equitylens-orchestrator`. Implementation commit: `53de3a4258b921e27ee098e9d574916a422db4c2`. Phase 3–5 remain **PLANNED**, with no approvals or real task execution.

## Delivered

- Isolated `tools/orchestrator/` module: validated plan/state, project management/state transitions, dependency scheduler, manual and experimental Codex worker adapters, SQLite store, checkpoints, QA gate, owner approval gate, bounded event/error history and conservative recovery.
- Local dashboard on 127.0.0.1:4310 with approval/start/pause/resume/stop, manual handoff, independent review, final acceptance, Git/tests/errors/worker/checkpoint/observed quota state.
- Persistent project roadmap, state/task/approval exports, decisions and reports directory. SQLite transactions are authoritative for workflow; actual Git state remains authoritative for code.
- Per-worktree live manager lock. Restart stops scheduling and marks interrupted work UNKNOWN; no blind replay or lease-expiry takeover.
- Official Codex interface research and local CLI capability inspection. No paid API, GUI automation, production deployment or persistent Windows service installed.
- Windows operator and recovery guide in `tools/orchestrator/README.md`, configuration example and Phase 3–5 scoped task definitions.

## Actual verification

| Check | Observed result |
| --- | --- |
| `npm run test:orchestrator` | 15 passed, 0 failed; includes real process termination/restart, lock exclusion, duplicate dispatch, missing/replayed approvals, changed plan, failed QA, cooldown/budget, pause persistence, HTTP/session/revision checks and external Git changes |
| `npm run test:orchestrator:browser` | PASS in local Chrome on harmless SIM fixture: approve/start/pause/resume/stop/handoff/QA/review/accept, 390px and 1440px, no page errors |
| `npm run lint` | PASS, rerun after final code/test changes |
| `npm run typecheck` | PASS, rerun after final code/test changes |
| `npm test` | 49 tests / 6 files passed |
| `npm run build` | PASS, 34 static pages generated |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 16 passed, 0 failed (34.8 seconds) |

The first application E2E run had 15 passes and one navigation race: a demo-tab click could hit the previous route before navigation completed. The regression test now waits for the valuation URL and destination heading before interacting, retaining the original assertion. The full suite then passed. No application financial code changed.

## Independent review and fixes

A separate read-only reviewer inspected locks, approval/recovery, CLI authentication and local HTTP security. The reviewer reproduced loss of Pause intent after QA/review; a failing regression was added and fixed. They also verified that native Codex login status can be written to stderr; authentication checking now reads both captured streams with successful exit status. Cookie comparison was hardened to compare byte lengths before constant-time comparison. Scope checking blocks QA when changed paths lie outside the approved task scope.

## Limits, not demonstrated claims

- **Validated operating mode is manual handoff.** Native Codex adapter is opt-in and experimental; no real model generation or quota exhaustion/recovery was run. Quota tests are simulated, not proof of recovery from a live quota event.
- No malicious-worker/same-Windows-account security boundary is claimed. Repository QA executes with local user permissions. Scope checks detect changes after execution, not prevent all side effects. Local owner controls are not multi-user authentication or proof of independent reviewer identity.
- Stop/Pause drain live work; no proven forced termination of arbitrary descendant processes. An unresolved worker remains blocked until owner inspection/reconciliation. One-managed-writer tests do not constrain unrelated editors or external automation.
- Existing third-party Auto Resume is independent and must not also own recovery of CLI worker sessions. Its global configuration was not changed by this implementation.
- JSON exports are individually atomic projections; SQLite is transactional authority. Event history retains the latest 200 entries, not immutable audit storage. Plan changes fail closed and require an explicit migration; no automatic migration/reset exists.
- State persistence uses Node's built-in SQLite, which emits an experimental warning on the tested Node 25.2.1 runtime. Minimum supported runtime is Node 24+ with node:sqlite.
- At this original implementation baseline Phase 2.1 was outstanding. See the revalidation section above for its current report status. Phase approval cannot substitute for financial validation or authorize deployment/purchases/trading.

## Handoff

Use `npm run orchestrator` and open http://127.0.0.1:4310. The owner must approve each phase and accept its final outcome separately. Review limits above before opting into CLI workers. Source implementation and report are committed separately so the report can identify a stable implementation SHA.
