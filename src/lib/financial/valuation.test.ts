import { describe, expect, it } from "vitest";
import { calculateFcff, calculateWacc, discountFactor, terminalValue, equityBridge, discountCashFlows, evaluateScenario, defaultScenarios, sensitivity, evaluateRelative, parseScenarios } from "./valuation";
import { createDatasetTemplate } from "./schema";
import type { Calculation, CorporateDataset } from "./types";
const value = <T>(r: Calculation<T>): T => { expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.issues.join(" ")); return r.value; };
const bridge = { cash: 20, debt: 30, nonOperatingAssets: 0, minorityInterest: 5, preferredEquity: 0, otherClaims: 0, sharesOutstanding: 10 };
const sample = () => createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
describe("DCF golden cases independently calculated", () => {
  it("keeps operating FCFF and simple CFO-minus-capex conceptually separate", () => {
    expect(value(calculateFcff(100, .2, 10, 20, 5))).toBe(65);
    expect(value(calculateWacc(.12, .06, .2, .75))).toBeCloseTo(.102);
  });
  it("discounts at year end and computes Gordon terminal value", () => {
    expect(value(discountFactor(.1, 2))).toBeCloseTo(1 / 1.21);
    expect(value(terminalValue(110, .1, 0))).toBe(1100);
  });
  it("reconciles every equity bridge item and actual shares", () => {
    expect(value(equityBridge(1000, bridge))).toEqual({ equityValue: 985, intrinsicValuePerShare: 98.5 });
    // Constant 100 cash flow forever has EV = 100 / 10% = 1000.
    const result = value(discountCashFlows([100, 100], .1, 0, bridge, 80));
    expect(result.enterpriseValue).toBeCloseTo(1000);
    expect(result.equityValue).toBeCloseTo(985);
    expect(result.intrinsicValuePerShare).toBeCloseTo(98.5);
    expect(result.upside).toBeCloseTo(.23125);
    expect(result.marginOfSafety).toBeCloseTo(18.5 / 98.5);
    // Ramp case: 100/1.1 + 110/1.21 + (110/.1)/1.21.
    expect(value(discountCashFlows([100, 110], .1, 0, bridge, 80)).enterpriseValue).toBeCloseTo(1090.9090909091);
  });
  it("rejects missing bridge claims, nonpositive shares and equity without clamping to zero", () => {
    expect(equityBridge(1000, { ...bridge, otherClaims: null }).ok).toBe(false);
    expect(equityBridge(1000, { ...bridge, sharesOutstanding: 0 }).ok).toBe(false);
    expect(equityBridge(10, { ...bridge, debt: 999 }).ok).toBe(false);
  });
  it("rejects invalid tax, discount rates, periods and nonfinite calculations", () => {
    for (const output of [calculateFcff(100, 2, 10, 20, 0), calculateFcff(100, .2, 10, -20, 0), calculateWacc(.1, .05, .2, 1.1), discountFactor(-1, 1), discountFactor(.1, 0), terminalValue(100, .02, .03), terminalValue(100, .1, .1), terminalValue(-100, .1, 0), discountCashFlows([NaN], .1, 0, bridge, null)]) expect(output.ok).toBe(false);
    expect(discountCashFlows([-50, 110], .1, 0, bridge, null).ok).toBe(true);
  });
});
describe("data-backed scenarios and sensitivity", () => {
  it("retains opening-period provenance for the displayed historical FCFF", () => {
    const d = sample();
    d.sources.push({ ...d.sources[0], id: "OPENING", provenance: "user_supplied" });
    d.reports[0].fields.operatingWorkingCapital.sourceId = "OPENING";
    const out = value(evaluateScenario(d, "FY2025", defaultScenarios(true)[1]));
    expect(out.provenance.sourceIds).toContain("OPENING");
    expect(value(out.historicalFcff)).toBe(152_000_000);
  });
  it("is invariant to equivalent money/share scales and does not mutate its input", () => {
    const d = sample(), a = defaultScenarios(true)[1], original = JSON.stringify(d);
    const baseline = value(evaluateScenario(d, "FY2025", a));
    expect(JSON.stringify(d)).toBe(original);
    for (const report of d.reports) for (const [key, fact] of Object.entries(report.fields)) {
      if (key !== "dilutedEps") { fact.value = fact.value === null ? null : fact.value / 1000; fact.unit = "billion"; }
    }
    d.market!.sharesOutstanding.value! *= 1e6; d.market!.sharesOutstanding.unit = "unit";
    const scaled = value(evaluateScenario(d, "FY2025", a));
    expect(scaled.intrinsicValuePerShare).toBeCloseTo(baseline.intrinsicValuePerShare, 6);
  });
  it("recomputes growth, EBIT, working capital, capex and FCFF from base annual data", () => {
    const data = sample(), assumptions = defaultScenarios(true)[1];
    const result = value(evaluateScenario(data, "FY2025", assumptions));
    const row = result.projections[0];
    expect(row.revenue).toBeCloseTo(1_200_000_000 * (1 + assumptions.growth!));
    expect(row.ebit).toBeCloseTo(row.revenue * assumptions.ebitMargin!);
    expect(row.changeWorkingCapital).toBeCloseTo(row.revenue * assumptions.workingCapitalRate! - 120_000_000);
    expect(row.fcff).toBeCloseTo(row.ebit * (1 - assumptions.taxRate!) + row.depreciation - row.capex - row.changeWorkingCapital);
    expect(row.presentValue).toBeCloseTo(row.fcff / (1 + assumptions.wacc!));
    expect(result.provenance.containsMock).toBe(true);
    expect(result.provenance.sourceIds).toEqual(["MOCK"]);
  });
  it("keeps assumptions blank until explicitly chosen and validates saved scenario JSON", () => {
    expect(defaultScenarios()[1].wacc).toBeNull();
    expect(evaluateScenario(sample(), "FY2025", defaultScenarios()[1]).ok).toBe(false);
    expect(parseScenarios(JSON.stringify(defaultScenarios(true))).ok).toBe(true);
    expect(parseScenarios(JSON.stringify([defaultScenarios(true)[0], defaultScenarios(true)[0], defaultScenarios(true)[2]])).ok).toBe(false);
  });
  it("changing a scenario changes valuation and sensitivity's center equals base", () => {
    const d = sample(), s = defaultScenarios(true)[1];
    const base = value(evaluateScenario(d, "FY2025", s));
    const higherDiscount = value(evaluateScenario(d, "FY2025", { ...s, wacc: s.wacc! + .02 }));
    expect(higherDiscount.intrinsicValuePerShare).toBeLessThan(base.intrinsicValuePerShare);
    const cells = sensitivity(d, "FY2025", s);
    expect(cells).toHaveLength(25);
    expect(value(cells[12].result).intrinsicValuePerShare).toBeCloseTo(base.intrinsicValuePerShare);
    expect(cells.find(c => c.wacc === s.wacc && c.growth === s.terminalGrowth)).toBeDefined();
  });
  it("blocks banks, securities and insurance even if user supplies plausible assumptions", () => {
    for (const industry of ["bank", "securities", "insurance"] as const) {
      const d = createDatasetTemplate("VCB", industry);
      expect(evaluateScenario(d, "FY2025", defaultScenarios(true)[1])).toMatchObject({ ok: false, code: "unsupported" });
      expect(evaluateRelative(d, "FY2025", "pb", 1)).toMatchObject({ ok: false, code: "unsupported" });
    }
  });
  it("blocks quarter/YTD, inconsistent accounts, unmatched basis and missing data", () => {
    const d = sample(), a = defaultScenarios(true)[1];
    d.reports[1].kind = "ytd";
    expect(evaluateScenario(d, "FY2025", a).ok).toBe(false);
    d.reports[1].kind = "annual"; d.market!.basis = "different";
    expect(evaluateScenario(d, "FY2025", a).ok).toBe(false);
    d.market!.basis = d.reports[1].basis; d.reports[1].fields.cash.value = null;
    expect(evaluateScenario(d, "FY2025", a).ok).toBe(false);
    d.reports[1].fields.cash.value = 150; d.reports[1].fields.totalAssets.value = 1;
    expect(evaluateScenario(d, "FY2025", a).ok).toBe(false);
  });
  it("relative methods use EPS, book equity and the EV bridge with source-backed units", () => {
    const d = sample();
    const pe = value(evaluateRelative(d, "FY2025", "pe", 10));
    expect(pe.intrinsicValuePerShare).toBeCloseTo(d.reports[1].fields.dilutedEps.value! * 10);
    const pb = value(evaluateRelative(d, "FY2025", "pb", 2));
    expect(pb.equityValue).toBe(2_000_000_000);
    const ev = value(evaluateRelative(d, "FY2025", "evEbitda", 5));
    expect(ev.enterpriseValue).toBe(1_500_000_000);
    expect(ev.equityValue).toBe(1_350_000_000);
    d.reports[1].fields.dilutedEps.value = -1;
    expect(evaluateRelative(d, "FY2025", "pe", 10).ok).toBe(false);
  });
});
