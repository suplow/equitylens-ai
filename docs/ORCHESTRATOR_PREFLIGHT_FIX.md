# Checkpoint/preflight correction — 2026-10-12

## Verified diagnosis

Read-only SQLite/Git inspection found two different worktrees:

- Original checkout (dashboard 4310): P3 BLOCKED, approved branch `feature/equitylens-orchestrator-validation`, baseline `f64b8c1`, actual HEAD `5be497c`, no non-runtime dirty files, matching identity and existing inputs. **Commit baseline mismatch**, not uncommitted CHECKPOINT.md, causes the current block.
- The full range includes `65de7c0` (runtime exports **and ten QA images**) followed by `5be497c` (CHECKPOINT.md only). Therefore the range must not be treated as runtime-only. Those existing commits are preserved.
- Clean worktree (dashboard 4311): branch `feature/equitylens-phase3-ready`, no approval and attempts zero. Its four dirty runtime exports do not block source cleanliness. Its approval baseline is intentionally absent.

## Correction

- Shared read-only `inspectPreflight` provides IDENTITY_CHANGED, APPROVAL_BASELINE_MISSING, BRANCH_CHANGED, COMMIT_CHANGED, DIRTY_FILES, INPUT_MISSING and INPUT_OUTSIDE_WORKTREE diagnostics. Dispatch uses the same checks; dashboard state exposes the result.
- Exact equality remains the normal commit guard. A descendant of the approved baseline may differ only if **every intervening commit**, including merge-parent diffs and both sides of renames, affects exclusively `project/STATE.json`, `TASKS.json`, `APPROVALS.json`, `CHECKPOINT.md`. Source changes then reverted still block. Non-descendants and histories exceeding 1,000 commits fail closed.
- Scope QA applies the same four-file projection exclusion. No exclusion for `qa/`, all of `project/`, documentation, source files or arbitrary temporary files was added.
- Exports are still atomic, but identical content is no longer rewritten every scheduler tick. SQLite remains authoritative; Git exports cannot grant approval. `.gitattributes` pins only the four projections to LF, without changing global Git configuration or renormalizing other files.

## Read-only usage

From the patched checkout:

```powershell
node tools/orchestrator/preflight.mjs
node tools/orchestrator/preflight.mjs ../equitylens-ai P3-1
```

The command reads SQLite without constructing a Manager, acquiring its execution lock, changing approvals or dispatching work. Exit 0 means repository checks match the stored baseline; it does not start a phase or override BLOCKED/PAUSED states. No baseline gives APPROVAL_BASELINE_MISSING. The original checkout correctly continues to report COMMIT_CHANGED because `65de7c0` contains non-runtime changes.

Neither running dashboard is restarted by this fix: restarting a Manager changes scheduler recovery state. The committed implementation is available for a deliberate subsequent restart. Existing approval baselines are not rebased to new code commits. Starting/resuming/reapproving a phase remains an owner action.

## Preservation

Both SQLite payloads were inspected read-only. Original state digest before changes: `5bd08471e0e142af781887d3c1900d1746f471242c1ff091acb4be5e95ecaa14`; clean worktree state digest: `628bb53107bb7d5f6a7e49b8dea353cf5822cfaae61272f85016c24a56aa8ae4`. No SQLite deletion, approval edit, Git reset, force-push, merge or Phase 3 launch was performed. Existing runtime exports and original user commits are excluded from the fix commit.

Regression tests cover checkpoint-only commits, source changes followed by revert, non-runtime project documentation, unchanged export mtime/fingerprint and read-only plan validation, in addition to existing identity/branch/scope/recovery tests.

Final verification: `npm run test:orchestrator` 27/27 PASS; `npm run lint` PASS; `npm run test:orchestrator:browser` PASS in Chrome at 390/1440 px with SIM-only tasks. Both SQLite payload digests above remained identical after verification. The patched read-only check on the original repository reports COMMIT_CHANGED; the clean repository still requires an approval baseline. Financial application source was not changed; its unit/build/E2E suites were not rerun for this isolated fix.
