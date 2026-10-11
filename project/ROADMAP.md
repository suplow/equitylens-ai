# EquityLens project roadmap

Baseline: `87eb4fdd88945a9edb8b6c5ff97dd6a50fd34bf5` on feature/equitylens-foundation.
Orchestrator implementation is authorized separately. **Phase 3, 4 and 5 are PLANNED, not approved.**

## Prerequisite: Phase 2.1

At the original baseline, financial validation remained unfinished. Phase 2.1 implementation and validation report are now committed and pushed at `8cd9524`; see `docs/PHASE2_1_REPORT.md` for actual tests and unresolved limitations. This does not approve Phase 3. After explicit owner approval, P3-1 must review those results and suitability for AI research inputs before further work.

## Phase 3 — AI Research Analyst

P3-1: audit financial readiness and supported ChatGPT integration/cost constraints.
P3-2: source-grounded financial research packets, structured interpretations, bull/bear thesis and risks.
P3-3: independent evidence/hallucination/injection regression evaluation.
Preserve manual ChatGPT handoff where automation is not demonstrated. No extra paid API by implication.

## Phase 4 — Vietnam Market Data

P4-1: provider availability and dated licensing evidence.
P4-2: authorized adapters, normalization, provenance, freshness, corporate actions and independent data tests. Updates only when permitted and configured. No protected-source bypass or purchase without approval.

## Phase 5 — Product Readiness

P5-1: architecture/auth/security review, database/backups, monitoring and deployment plan.
P5-2: source-grounded reports/PDF, accessibility and performance evidence, operating procedures.
Deployment is a separate owner decision, never a phase side effect.

Machine-readable task scope, dependencies, inputs, acceptance criteria, required tests and retry budgets: `tools/orchestrator/plan.json`. A plan hash binds approvals to exactly that plan. Changing it refuses existing state rather than silently approving a new scope.
