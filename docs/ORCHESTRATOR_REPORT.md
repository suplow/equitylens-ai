# Orchestrator implementation report

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
- Phase 2.1 remains outstanding; the P3 readiness task requires its report. Phase approval cannot substitute for financial validation or authorize deployment/purchases/trading.

## Handoff

Use `npm run orchestrator` and open http://127.0.0.1:4310. The owner must approve each phase and accept its final outcome separately. Review limits above before opting into CLI workers. Source implementation and report are committed separately so the report can identify a stable implementation SHA.
