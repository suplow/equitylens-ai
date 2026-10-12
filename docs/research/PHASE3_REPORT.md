# Phase 3 — Financial evidence integration

Date: 2026-10-12. Starting commit: `f01035dc691b05d415bfd98d318100798a6ac2cc`. User explicitly authorized continuing Phase 3. Phase 4–5 are not started or implicitly approved. Work is performed directly in the integrated worktree; orchestrator SQLite approvals/acceptance were not edited to pretend automatic execution succeeded.

## Feasibility and boundaries

The existing ChatGPT workflow remains: prepare locally, inspect, manually copy to ChatGPT, import JSON. No new paid API, browser-session automation, credentials or automatic upload. Official [Codex authentication documentation](https://learn.chatgpt.com/docs/auth) distinguishes ChatGPT sign-in from API-key authentication. The prior real CLI demonstration on this machine failed sandbox execution; that remains a separate automation limitation, not a reason to fabricate an automatic AI connection.

Phase 2.1 offers deterministic ratios, provenance, period/date guards and valuation scenarios. Its sources remain mock or user-supplied/unverified; source documents, market freshness and economic assumptions are not independently authenticated. Those limits carry into the research packet.

## Implemented

- `financial-evidence.ts` revalidates financial JSON, stock identity, industry, report selection and optional scenario JSON. It recomputes Engine results instead of trusting imported calculated values.
- Packet E01 includes 27 ratio outputs with formulas, inputs and source lineage; period, scope, basis/restatement, publication/analysis/market dates; data-quality report; and optional Bear/Base/Bull assumptions and valuation results. Missing or locked results stay unavailable. No default valuation assumptions are inserted.
- Any mock financial source marks the entire research packet `mock_practice`, independently of the dashboard-mock checkbox. No VERIFIED label is generated.
- AI Analyst loads the explicitly saved Financial Analysis dataset from the same browser origin. User chooses a report and attachment consent; scenario JSON is optional. Editing these choices invalidates the prior snapshot/report. The preview exposes formulas, input evidence and reasons for locked metrics.
- E01 factual/interpretive claims require structured `financialClaims`. Import checks each ratio ID, exact raw value and unit against the packet. Unknown IDs, unavailable metrics, altered values and percent scaling mistakes are rejected. The UI displays these checked fields next to the unverified prose.
- Existing seven-section report, Bull/Bear/refutation/risk instructions, source IDs, mock warnings, manual export/import, React text rendering and strict JSON limits remain.
- Packet size is bounded at 750,000 characters. Source/report JSON is never executed and source URLs are not fetched.

## Verification actually run

- `npm test`: **289 passed**, 12 files. The independent stable fixture gives gross margin 0.4, calculated previously using Python Decimal, not a new expected value generated from this adapter.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed; build generated 34 routes.
- Full `npm run test:e2e` initially: 19 passed, new test failed on a label locator. Actual DOM showed the correctly named combobox; switched test to its accessible role. Rerun `npx playwright test tests/research-engine.spec.ts`: **1 passed**, confirming local saved data → ratio 0.4 → E01 → MOCK warning. Full suite was not rerun after that test-only locator correction.
- A missing-data test initially generated malformed JSON by regex. Replaced it with a JSON replacer; regression now proves an unavailable gross margin cannot be cited as zero.
- Added checks for wrong stock/industry/period, invalid scenarios, stale packet identity, wrong values/units/IDs, mock propagation and injected instructions remaining unverified data.

## Remaining work / limits

This is a usable Phase 3 integration increment, not final acceptance of the entire autonomous research system. Numerical field equality does **not** prove that claim prose is supported by a source; a valid metric can still accompany a misleading interpretation. External document facts, quotes, URLs and qualitative Bull/Bear claims still require human review. Scenario outputs are included with date guards, but structured import verification currently covers ratios only, not arbitrary valuation statements. TTM-derived reports are not yet selectable here; annual/quarter/YTD reports from the saved dataset are supported as the engine permits.

Prompt-injection regression checks packaging and application behavior, not guaranteed LLM resistance. No live ChatGPT research-evaluation corpus or independent end-to-end research review was run. These items, plus source-quote verification and stronger valuation claim bindings, remain before claiming complete Phase 3 acceptance. The application does not guarantee returns, issue orders or treat intrinsic values as certain future prices.

## Local use

1. In Financial Analysis, import/apply a valid dataset and save it locally.
2. Open AI Analyst for the same symbol → **Đính kèm Financial Engine** → **Nạp dữ liệu tài chính đã lưu**.
3. Select the report; optionally paste the array of three scenario assumptions (not the enclosing saved bundle). Check **Đưa kết quả Financial Engine vào hồ sơ**.
4. Create the packet and inspect warnings/formulas. Copy to your existing ChatGPT conversation only when ready.
5. Import the resulting JSON. E01 ratio claims need raw fractional values and exact units; check prose and underlying documents manually even when validation succeeds.

Local financial data, runtime projections, SQLite and Git history were preserved. No deployment, paid service, force push or merge.

## Evidence and valuation binding increment (2026-10-12)

Added optional structured `quotes` and `valuationClaims` to imported claims. Quotes must match an exact substring of the cited D01–D08/M01 source. Invented quotes, unknown/uncited sources and using document quotes to impersonate Engine evidence are rejected. Legacy reports without quotes remain importable with an explicit missing-evidence warning, rather than silently being considered verified.

Valuation references bind to Bear/Base/Bull, an allowlisted output field, its exact raw number, currency/unit and `provenance.valuationAsOf`. Wrong currency, dates, values and null/locked outputs are rejected; null upside cannot become zero. E01 references may contain either ratio or valuation evidence. Prompt and UI expose the rules and distinguish literal matching from semantic/factual verification.

Verification: 293 unit tests passed; typecheck, lint and build passed. Full Chrome E2E: 20 passed (45 seconds). The existing XSS/browser workflow was extended to render an exact quote as text and reject an invented replacement; this extension was rerun separately after the full suite. These are deterministic application tests, not live LLM-evaluation results.

This supersedes the earlier limitation that only ratio fields are bound on import. Source authenticity, whether a quotation supports a claim, uncited numbers embedded in free prose, and live-model adversarial evaluation remain unresolved. Do not claim complete Phase 3 acceptance from matching numeric fields or substrings alone.
