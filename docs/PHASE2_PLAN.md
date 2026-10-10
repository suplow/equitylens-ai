# Phase 2 — Financial Intelligence Engine

Audit: 10/10/2026. Branch: `feature/equitylens-foundation`. Existing working tree was clean before implementation. README, AGENTS, all docs/research documents and app/component/data/research architecture reviewed.

## Baseline

Next.js/TypeScript, Recharts, Zod, Vitest and Playwright already installed. No new dependency required. Dashboard, watchlist, six demo tickers, financial statement preview, stock charts, valuation preview, seven-section report template and manual ChatGPT research transfer already work. Provider ratios are independent mock fixtures; they are not calculated results. Research JSON checks references/shape, not factual truth.

Pre-change checks: lint passed; typecheck passed; 15 unit tests passed; build passed (dashboard + 30 ticker/section pages). Phase 1 E2E suite will be retained and extended for the new default financial/valuation workspace.

## Modules and ownership

1. Root: typed dataset schema, boundary validation, source provenance, unit normalization, period conversion, ratio pure functions and formula documentation; tests before implementation.
2. Quant/research agents: reference and risk audit. Root implemented FCFF/WACC/DCF, explicit equity bridge, relative valuation, scenarios/sensitivity and golden-case tests after research agents reached their session quota; no market figures invented.
3. UI agent: JSON input/file import, explicit local save/load/export, financial tables/history/ratios and scenario controls in existing design system. Preserve Phase 1 demo behind a clearly labeled tab.
4. Root and QA reviewer: independent checks of formulas, unit/period/sector boundaries, integration/E2E, lint/typecheck/build, documentation and Git push after verification.

## Contract decisions

- Financial datasets versioned independently from the Phase 1 stock provider. A fact is nullable, names its source/location and scale. Currency is explicit at dataset level; period, scope, audit/publication metadata is inherited by each fact in its report. No automatic FX; unlike scale changes, currency conversion needs a separately sourced rate/method and is blocked here.
- Canonical arithmetic uses base currency and actual shares; presentation may scale amounts. Import never promotes user-supplied data to Verified. Calculated results retain source IDs and mock/unverified status.
- Corporate statements are separate from bank/securities/insurance report shapes. Specialized institutions are accepted as typed shells, but corporate ratios and all valuation results remain locked until a complete specialized model exists.
- Annual, standalone quarter and YTD are distinguished. Ratios refer to their actual period without implicit annualization. YTD flow conversion subtracts only matching prior YTD flows; balance sheet stocks stay at period end; EPS cannot be differenced. Annual market multiples/DCF require annual input. No fabricated TTM or opening balances.
- Average beginning/end balances for returns and turnover. Missing, zero/negative denominator, incompatible period/scope and sector mismatch produce explicit unavailable/not-meaningful states, not zero.
- CFO minus CAPEX is labeled simple FCF, not FCFF. FCFF = EBIT × (1−tax) + D&A − CAPEX − change in operating working capital; WACC discounts FCFF. All bridge items including zero claims must be explicit.
- DCF uses year-end discounting, transparent growth/margin/reinvestment assumptions and Gordon terminal value only with WACC > g. Bear/Base/Bull are assumptions without probabilities. Sensitivity reuses exactly the same valuation function.
- Peer figures must be provided with sources and selection/difference notes; never backfill from mock provider. P/E/P/B/EV multiples use compatible definitions and positive denominators.
- JSON and local storage have size/schema checks. React renders text; no dynamic expression evaluation, external data fetching, PDF extraction, AI calls or secrets.

## Main risks and controls

1. Million/billion confusion: explicit scales, finite/safe-range checks, conversion unit tests, per-share values never scaled as statement amounts.
2. YTD/quarter/annual confusion: typed period metadata and strict compatibility; quarterly EPS stays unavailable on conversion.
3. Parent/common versus total profit/equity: separate net income attributable to common shareholders; ROE/EPS multiples use corresponding equity/earnings.
4. CFO−CAPEX mislabeled FCFF: separate functions/output and formula notes.
5. Mixed scope, changed restatement basis or corporate actions: matching scope/basis checks; no silent restatement/split adjustments.
6. False confidence in user input: source status remains unverified even after passing schema. Accounting consistency checks flag internally contradictory statements; no universal financial health score.
7. Negative equity/earnings and unstable terminal value: explicit guards, visible reasons and terminal-value contribution warning.
8. Stale storage/scenarios: validate on restore; key data by ticker and preserve failed JSON input. Recalculate from current validated data/assumptions.

## Acceptance and delivery

User imports valid annual statements, views formula-backed ratios, saves/restores locally, edits three scenarios and sees reproducible DCF/equity bridge/per-share results, reference-price difference, margin of safety and sensitivity. Null/invalid/sector-incompatible input stays visibly blocked. Existing Phase 1 flows continue working. Record actual tests and deferred scope in `docs/PHASE2_REPORT.md`, commit and push only the current working branch, no force push/merge/deploy.
