import { describe, expect, it } from "vitest";
import { createDatasetTemplate, convertYtdToQuarter, parseFinancialDataset } from "./schema";
import { analyzeRatios, openingReport } from "./ratios";
import { defaultScenarios, evaluateScenario, evaluateRelative, historicalFcff } from "./valuation";
import type { CorporateDataset } from "./types";
import { comparisonDateGuard, marketDateGuard } from "./dates";

const fixture = () => createDatasetTemplate("TEST", "corporate", true) as CorporateDataset;
describe("Phase 2.1 independently reproduced integrity regressions", () => {
  it("does not arbitrarily choose same-date annual versus quarterly opening balances", () => {
    const data = fixture(); const duplicate = structuredClone(data.reports[0]);
    Object.assign(duplicate, { id: "Q4", kind: "quarter", fiscalQuarter: 4, startDate: "2024-10-01" });
    duplicate.fields.shareholdersEquity.value = 1500; duplicate.fields.totalAssets.value = 1950;
    duplicate.fields.operatingWorkingCapital.value = 200;
    data.reports.push(duplicate); expect(parseFinancialDataset(JSON.stringify(data)).ok).toBe(true);
    for (const reports of [data.reports, [...data.reports].reverse()]) {
      const d = { ...data, reports }; expect(openingReport(d, data.reports[1])).toBeUndefined();
      expect(analyzeRatios(d, "FY2025").find(r => r.id === "roe")?.result.ok).toBe(false);
      expect(historicalFcff(d, data.reports[1]).ok).toBe(false);
    }
  });
  it("keeps retrospective valuation but blocks mismatched market date comparisons", () => {
    const data = fixture(); const dcf = evaluateScenario(data, "FY2025", defaultScenarios(true)[1]);
    expect(dcf.ok).toBe(true); if (dcf.ok) { expect(dcf.value.upside).toBeNull(); expect(dcf.value.marginOfSafety).toBeNull(); }
    const relative = evaluateRelative(data, "FY2025", "pe", 10);
    expect(relative.ok).toBe(true); if (relative.ok) expect(relative.value.upside).toBeNull();
  });
  it("validates YTD calendar even when called directly outside the JSON parser", () => {
    const d = fixture(); const current = { ...d.reports[1], kind: "ytd" as const, fiscalQuarter: 2 as const, endDate: "2025-05-31" };
    const prior = { ...current, id: "Q1", fiscalQuarter: 1 as const, endDate: "2025-03-31" };
    expect(convertYtdToQuarter(current, prior).ok).toBe(false);
  });
  it("accepts explicit compatible opening balances and rejects mixed scope/basis", () => {
    const d = fixture(); const copy = structuredClone(d.reports[0]); copy.id = "REVISED"; copy.restatement = { status: "restated", revision: "v2", note: "Independent revision fixture" }; d.reports.push(copy);
    expect(parseFinancialDataset(JSON.stringify(d)).ok).toBe(true);
    expect(openingReport(d, d.reports[1])).toBeUndefined();
    d.reports[1].openingReportId = "REVISED"; expect(openingReport(d, d.reports[1])?.id).toBe("REVISED");
    copy.scope = "standalone"; expect(openingReport(d, d.reports[1])).toBeUndefined();
    copy.scope = "consolidated"; copy.basis = "incompatible restatement"; expect(openingReport(d, d.reports[1])).toBeUndefined();
  });
  it("finds exact opening balance for a June year end and rejects missing opening", () => {
    const d = fixture(); d.fiscalYearEndMonth = 6;
    d.reports.forEach(r => { r.startDate = `${r.fiscalYear - 1}-07-01`; r.endDate = `${r.fiscalYear}-06-30`; });
    expect(openingReport(d, d.reports[1])?.id).toBe("FY2024");
    d.reports[0].endDate = "2024-06-29"; expect(openingReport(d, d.reports[1])).toBeUndefined();
  });
  it("locks stale/future/invalid market dates and disclosed corporate actions", () => {
    const d = fixture(); const r = d.reports[1]; expect(marketDateGuard(d, r).ok).toBe(true);
    d.analysisAsOf = "2026-06-01"; expect(marketDateGuard(d, r).ok).toBe(false);
    d.analysisAsOf = "2026-03-01"; expect(marketDateGuard(d, r).ok).toBe(false);
    d.analysisAsOf = "2026-04-01"; d.market!.asOf = "2026-02-30"; expect(marketDateGuard(d, r).ok).toBe(false);
    d.market!.asOf = "2026-04-01"; d.corporateActions!.events.push({ date: "2026-02-01", kind: "issuance" }); expect(marketDateGuard(d, r).ok).toBe(false);
  });
  it("does not use later share counts to divide retrospective enterprise value", () => {
    const d = fixture(); d.market!.sharesAsOf = "2026-04-01";
    const result = evaluateScenario(d, "FY2025", defaultScenarios(true)[1]); expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.enterpriseValue).toBeGreaterThan(0); expect(result.value.intrinsicValuePerShare).toBeNull(); expect(result.value.upside).toBeNull(); }
  });
  it("only permits comparisons with valid matching dates and an explicit as-of", () => {
    const dates = { valuationAsOf: "2025-12-31", sharesAsOf: "2025-12-31", marketAsOf: "2025-12-31", analysisAsOf: "2025-12-31" };
    expect(comparisonDateGuard(dates).ok).toBe(true);
    expect(comparisonDateGuard({ ...dates, analysisAsOf: "2026-02-30" }).ok).toBe(false);
    expect(comparisonDateGuard({ ...dates, analysisAsOf: "2026-03-31" }).ok).toBe(false);
    expect(comparisonDateGuard().ok).toBe(false);
  });
  it("rejects invalid analysis dates and inconsistent current statements on direct engine calls", () => {
    const d = fixture(); d.analysisAsOf = "2026-04-31";
    expect(evaluateScenario(d, "FY2025", defaultScenarios(true)[1]).ok).toBe(false);
    expect(evaluateRelative(d, "FY2025", "pb", 2).ok).toBe(false);
    d.analysisAsOf = "2026-04-01";
    d.reports[1].fields.totalAssets.value = 999999;
    expect(historicalFcff(d, d.reports[1]).ok).toBe(false);
  });
});
