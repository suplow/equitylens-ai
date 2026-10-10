import { describe, expect, it } from "vitest";
import * as r from "./ratios";
import { createDatasetTemplate } from "./schema";
import type { Calculation, CorporateDataset } from "./types";
const value = (result: Calculation<number>) => { expect(result.ok).toBe(true); return result.value; };

describe("financial ratio golden values", () => {
  it("calculates profitability from compatible inputs and average balances", () => {
    expect(value(r.grossMargin(40, 100))).toBeCloseTo(.4);
    expect(value(r.operatingMargin(20, 100))).toBeCloseTo(.2);
    expect(value(r.netProfitMargin(12, 100))).toBeCloseTo(.12);
    expect(value(r.roe(20, 80, 120))).toBeCloseTo(.2);
    expect(value(r.roa(20, 180, 220))).toBeCloseTo(.1);
    expect(value(r.roic(30, .2, 100, 140))).toBeCloseTo(.2);
  });
  it("calculates liquidity, interest-bearing leverage and efficiency", () => {
    expect(value(r.currentRatio(150, 50))).toBe(3);
    expect(value(r.quickRatio(20, 40, 50))).toBeCloseTo(1.2);
    expect(value(r.cashRatio(20, 50))).toBeCloseTo(.4);
    expect(value(r.debtToEquity(10, 40, 100))).toBeCloseTo(.5);
    expect(value(r.netDebt(10, 40, 70))).toBe(-20);
    expect(value(r.interestCoverage(30, 5))).toBe(6);
    expect(value(r.assetTurnover(300, 100, 200))).toBe(2);
    expect(value(r.inventoryTurnover(80, 30, 50))).toBe(2);
    expect(value(r.receivableDays(30, 50, 200, 365))).toBe(73);
  });
  it("distinguishes simple FCF, cash conversion and growth", () => {
    expect(value(r.operatingCashFlowToNetIncome(30, 20))).toBe(1.5);
    expect(value(r.freeCashFlow(30, 10))).toBe(20);
    expect(value(r.fcfMargin(30, 10, 100))).toBeCloseTo(.2);
    expect(value(r.cashConversion(30, 25, 5))).toBe(1);
    expect(value(r.growth(120, 100))).toBeCloseTo(.2);
    expect(value(r.growth(-50, 100))).toBeCloseTo(-1.5);
    expect(value(r.cagr(100, 144, 2))).toBeCloseTo(.2);
  });
  it("calculates annual market multiples and yields", () => {
    expect(value(r.pe(30, 2))).toBe(15);
    expect(value(r.pb(30, 100, 50))).toBe(15);
    expect(value(r.evEbitda(100, 25, 5))).toBeCloseTo(100 / 30);
    expect(value(r.fcfYield(30, 10, 100))).toBeCloseTo(.2);
  });
  it("does not turn null, zero, negative denominator or nonfinite input into a valid ratio", () => {
    for (const result of [r.roe(10, null, 100), r.roe(10, -20, 100), r.pe(10, -1), r.pb(10, -100, 5), r.grossMargin(10, 0), r.currentRatio(10, -2), r.growth(10, 0), r.cagr(-1, 100, 5), r.cagr(10, 100, 0), r.currentRatio(Infinity, 2), r.freeCashFlow(10, -1), r.roic(20, 1.2, 10, 20)]) expect(result.ok).toBe(false);
    expect(r.pe(100, null)).toMatchObject({ ok: false, code: "missing_data", value: null });
    expect(r.pe(100, -10)).toMatchObject({ ok: false, code: "not_meaningful", value: null });
  });
});
describe("dataset to ratios integration", () => {
  it("excludes incompatible annual trends and blocks a contradictory CAGR starting period", () => {
    const data = createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
    data.reports[0].scope = "standalone";
    expect(r.getHistoricalRows(data).map(row => row.period)).toEqual(["FY2025"]);
    data.reports[0].scope = "consolidated";
    data.reports[0].fields.grossProfit.value = 999;
    expect(r.analyzeRatios(data, "FY2025").find(m => m.id === "revenueCagr")!.result.ok).toBe(false);
  });
  it("rejects economically invalid price and EV numerators without suppressing operating losses", () => {
    expect(r.pe(-1, 5).ok).toBe(false);
    expect(r.pb(-1, 100, 5).ok).toBe(false);
    expect(r.evEbitda(-10, 20, 5).ok).toBe(false);
    expect(value(r.netProfitMargin(-10, 100))).toBe(-.1);
  });
  it("provides formula, input source locations and calculated/mock provenance", () => {
    const data = createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
    const ratios = r.analyzeRatios(data, "FY2025");
    const metric = ratios.find(m => m.id === "roe")!;
    expect(value(metric.result)).toBeCloseTo(176 / 875);
    expect(metric.formula).toContain("bình quân");
    expect(metric.inputs.some(i => i.periodId === "FY2024")).toBe(true);
    expect(metric.provenance).toMatchObject({ kind: "calculated", containsMock: true, sourceIds: ["MOCK"] });
    expect(ratios).toHaveLength(27);
  });
  it("blocks incompatible average balances, market dates and financial institutions", () => {
    const data = createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
    data.reports[0].scope = "standalone";
    expect(r.analyzeRatios(data, "FY2025").find(m => m.id === "roe")!.result.ok).toBe(false);
    data.market!.asOf = "2025-01-01";
    expect(r.analyzeRatios(data, "FY2025").find(m => m.id === "pe")!.result.ok).toBe(false);
    for (const industry of ["bank", "securities", "insurance"] as const) expect(r.analyzeRatios(createDatasetTemplate("VCB", industry), "FY2025").every(m => !m.result.ok)).toBe(true);
  });
  it("flags conflicting accounting totals and does not call validated input verified", () => {
    const data = createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
    data.reports[1].fields.grossProfit.value = 999;
    expect(r.getDatasetWarnings(data).join(" ")).toContain("lợi nhuận gộp");
    expect(r.analyzeRatios(data, "FY2025").find(m => m.id === "grossMargin")!.result.ok).toBe(false);
  });
});
