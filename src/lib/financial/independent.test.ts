import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as ratios from "./ratios";
import { convertYtdToQuarter, normalizeReport, parseFinancialDataset } from "./schema";
import { buildTtm } from "./ttm";
import {
  calculateFcff, calculateWacc, discountCashFlows, discountFactor,
  equityBridge, evaluateRelative, evaluateScenario, historicalFcff,
  parseScenarios, sensitivity, terminalValue,
} from "./valuation";
import type { Calculation, CorporateDataset } from "./types";

// These files are generated offline by stdlib Python Decimal, never by this engine.
const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")) as T;
type Golden = { value: unknown; code?: string; projections?: unknown[] };
type Expected = {
  reportId: string;
  ratios: Record<string, Golden>;
  pureInputs: Record<string, (string | null)[]>;
  historicalFcff: Golden;
  scenarios: Record<string, Golden>;
  relative: Record<string, Record<string, Golden>>;
  sensitivity: { wacc: string; growth: string; result: Golden }[];
  ytdDifference?: { currentId: string; priorId: string; startDate: string; endDate: string; values: Record<string, string | null> };
  ttm?: { quarterIds: string[]; openingId: string; startDate: string; endDate: string; days: number; values: Record<string, string | null> };
};
const must = <T>(result: Calculation<T>): T => {
  if (!result.ok) throw new Error(`${result.code}: ${result.issues.join(" ")}`);
  return result.value;
};

/** Compare only declared goldens; provenance/warnings get their own assertions. */
function matchNumbers(actual: unknown, expected: unknown, path = "value") {
  if (expected === null) { expect(actual, path).toBeNull(); return; }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    expect((actual as unknown[]).length, path).toBe(expected.length);
    expected.forEach((v, i) => matchNumbers((actual as unknown[])[i], v, `${path}[${i}]`));
    return;
  }
  if (typeof expected === "object") {
    expect(actual, path).not.toBeNull();
    for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
      matchNumbers((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
    }
    return;
  }
  const n = Number(expected);
  expect(typeof actual, path).toBe("number");
  expect(Number.isFinite(actual as number), path).toBe(true);
  // JS doubles versus 50-digit Decimal: 1e-12 relative or 1e-7 absolute.
  expect(Math.abs((actual as number) - n), path).toBeLessThanOrEqual(Math.max(1e-7, Math.abs(n) * 1e-12));
}
function matchResult(actual: Calculation<unknown>, expected: Golden) {
  if (expected.value === null) {
    expect(actual).toMatchObject({ ok: false, value: null, code: expected.code });
  } else {
    expect(actual.ok).toBe(true);
    if (actual.ok) matchNumbers(actual.value, expected.value);
  }
}

type PureRatio = (...args: (number | null)[]) => Calculation<number>;
const pure: Record<string, PureRatio> = {
  grossMargin: ratios.grossMargin, operatingMargin: ratios.operatingMargin, netProfitMargin: ratios.netProfitMargin,
  roe: ratios.roe, roa: ratios.roa, roic: ratios.roic, currentRatio: ratios.currentRatio,
  quickRatio: ratios.quickRatio, cashRatio: ratios.cashRatio, debtToEquity: ratios.debtToEquity,
  netDebt: ratios.netDebt, interestCoverage: ratios.interestCoverage, assetTurnover: ratios.assetTurnover,
  inventoryTurnover: ratios.inventoryTurnover, receivableDays: ratios.receivableDays,
  cfoNetIncome: ratios.operatingCashFlowToNetIncome, freeCashFlow: ratios.freeCashFlow,
  fcfMargin: ratios.fcfMargin, cashConversion: ratios.cashConversion,
  revenueGrowth: ratios.growth, earningsGrowth: ratios.growth, epsGrowth: ratios.growth,
  revenueCagr: ratios.cagr, pe: ratios.pe, pb: ratios.pb, evEbitda: ratios.evEbitda, fcfYield: ratios.fcfYield,
};

for (const name of ["stable", "growth", "distressed"] as const) {
  const raw = readFileSync(new URL(`./fixtures/${name}.input.json`, import.meta.url), "utf8");
  const data = must(parseFinancialDataset(raw)) as CorporateDataset;
  const expected = fixture<Expected>(`${name}.expected`);
  const scenarios = must(parseScenarios(JSON.stringify(fixture(`${name}.scenarios`))));

  describe(`independent MOCK ${name}`, () => {
    it("uses its own complete 2.0 fixture and preserves source labels", () => {
      expect(data.version).toBe("2.0");
      expect(data.name).toContain("MOCK");
      expect(data.sources.every(s => s.provenance === "mock")).toBe(true);
      expect(Object.keys(expected.ratios)).toHaveLength(27);
      expect(ratios.accountingIssues(data.reports.find(r => r.id === expected.reportId)!)).toEqual([]);
    });

    if (name !== "distressed") for (const [id, golden] of Object.entries(expected.ratios)) {
      it(`checks pure ${id} against independent Decimal arithmetic`, () => {
        const inputs = expected.pureInputs[id].map(n => n === null ? null : Number(n));
        matchResult(pure[id](...inputs), golden);
      });
    }
    for (const [id, golden] of Object.entries(expected.ratios)) {
      it(`checks dataset ${id}, including normalization and missing-value status`, () => {
        const output = ratios.analyzeRatios(data, expected.reportId).find(r => r.id === id)!;
        matchResult(output.result, golden);
        expect(output.provenance.containsMock).toBe(true);
        expect(output.provenance.sourceIds).toEqual(["SYNTHETIC"]);
      });
    }
    it("distinguishes historical FCFF from simple CFO less CAPEX", () => {
      matchResult(historicalFcff(data, data.reports.find(r => r.id === expected.reportId)!), expected.historicalFcff);
    });
    for (const assumption of scenarios) {
      it(`checks every ${assumption.name} projection, terminal value, EV and equity bridge`, () => {
        const before = JSON.stringify(data);
        const actual = evaluateScenario(data, expected.reportId, assumption);
        const golden = expected.scenarios[assumption.name];
        matchResult(actual, golden);
        if (actual.ok) {
          matchNumbers(actual.value.projections, golden.projections);
          expect(actual.value.provenance.containsMock).toBe(true);
          expect(actual.value.provenance.valuationAsOf).toBe("2025-12-31");
        }
        expect(JSON.stringify(data)).toBe(before);
      });
      for (const [method, key] of [["pe", "peMultiple"], ["pb", "pbMultiple"], ["evEbitda", "evEbitdaMultiple"]] as const) {
        it(`checks ${assumption.name} ${method} with complex claims or blocked status`, () => {
          matchResult(evaluateRelative(data, expected.reportId, method, assumption[key]), expected.relative[assumption.name][method]);
        });
      }
    }
    it("checks all 25 sensitivity cells against independently discounted cash flows", () => {
      const cells = sensitivity(data, expected.reportId, scenarios[1]);
      expect(cells).toHaveLength(25);
      cells.forEach((cell, i) => {
        matchNumbers(cell.wacc, expected.sensitivity[i].wacc);
        matchNumbers(cell.growth, expected.sensitivity[i].growth);
        matchResult(cell.result, expected.sensitivity[i].result);
      });
    });
    if (expected.ttm) it("checks independently calculated TTM values and integrated ratio lineage", () => {
      const e = expected.ttm!;
      const output = must(buildTtm(data, e.quarterIds.at(-1)!, "quarters"));
      expect(output.report.startDate).toBe(e.startDate); expect(output.report.endDate).toBe(e.endDate);
      matchNumbers(normalizeReport(output.report).values, e.values);
      const report = { ...output.report, openingReportId: e.openingId, derived: { method: output.method, inputs: output.inputs, reportIds: output.reportIds } };
      const derived = { ...data, reports: [...data.reports, report], sources: [...data.sources, output.source] };
      const margin = ratios.analyzeRatios(derived, report.id).find(r => r.id === "grossMargin")!;
      expect(must(margin.result)).toBeCloseTo(Number(e.values.grossProfit) / Number(e.values.revenue));
      expect(new Set(margin.inputs.map(i => i.periodId)).size).toBe(4);
      expect(ratios.analyzeRatios(derived, report.id).find(r => r.id === "pe")?.result.ok).toBe(false);
    });
    if (expected.ytdDifference) it("differences YTD flows, retains closing balances and refuses EPS subtraction", () => {
      const e = expected.ytdDifference!;
      const current = data.reports.find(r => r.id === e.currentId)!;
      const previous = data.reports.find(r => r.id === e.priorId)!;
      const actual = must(convertYtdToQuarter(current, previous));
      expect(actual.startDate).toBe(e.startDate);
      expect(actual.endDate).toBe(e.endDate);
      matchNumbers(actual.values, e.values);
    });
  });
}

describe("independent hand arithmetic", () => {
  const core = fixture<Record<string, unknown>>("core.expected");
  const simple = { cash: 20, debt: 30, nonOperatingAssets: 0, minorityInterest: 5, preferredEquity: 0, otherClaims: 0, sharesOutstanding: 10 };
  it("checks FCFF, WACC, discount factor and Gordon terminal separately", () => {
    matchNumbers(must(calculateFcff(100, .2, 10, 20, 5)), core.fcff);
    matchNumbers(must(calculateWacc(.12, .06, .2, .75)), core.wacc);
    matchNumbers(must(discountFactor(.1, 2)), core.discountFactorYear2);
    matchNumbers(must(terminalValue(110, .1, 0)), core.terminalValue);
  });
  for (const [key, flows] of [["constantDcf", [100, 100]], ["rampDcf", [100, 110]], ["negativeIntermediate", [-50, 110]]] as const) {
    it(`checks ${key} without assuming the comparison date`, () => {
      matchResult(discountCashFlows([...flows], .1, 0, simple, null), core[key] as Golden);
    });
  }
  it("subtracts each independent claim once, without replacing missing claims by zero", () => {
    const claims = { cash: 20, debt: 300, nonOperatingAssets: 40, minorityInterest: 50, preferredEquity: 25, otherClaims: 75, sharesOutstanding: 10 };
    const golden = core.complexClaims as Record<string, unknown>;
    matchNumbers(must(equityBridge(1000, claims)), { equityValue: golden.equityValue, intrinsicValuePerShare: golden.intrinsicValuePerShare });
    expect(equityBridge(1000, { ...claims, otherClaims: null })).toMatchObject({ ok: false, code: "missing_data" });
    expect(equityBridge(1000, { ...claims, debt: 2000 })).toMatchObject({ ok: false, code: "not_meaningful" });
  });
});
