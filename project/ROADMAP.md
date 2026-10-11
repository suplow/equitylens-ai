# EquityLens project roadmap

Baseline: `87eb4fdd88945a9edb8b6c5ff97dd6a50fd34bf5` on feature/equitylens-foundation.
Orchestrator implementation is authorized separately. **Phase 3, 4 and 5 are PLANNED, not approved.**

## Prerequisite: Phase 2.1

Financial validation work is not accepted or complete at this baseline. The known period-selection and valuation-date concerns must be resolved and documented in `docs/PHASE2_1_REPORT.md` before P3-1 can execute. This orchestrator does not certify Phase 2.1 by creating a roadmap.

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
