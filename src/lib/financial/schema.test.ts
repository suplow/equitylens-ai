import { describe, expect, it } from "vitest";
import { createDatasetTemplate, parseFinancialDataset, normalizeReport, convertYtdToQuarter, convertUnit } from "./schema";
import type { CorporateDataset } from "./types";

const sample = () => createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
describe("financial data boundary", () => {
  it("keeps missing facts null and accepts a transparent mock template", () => {
    const blank = createDatasetTemplate("FPT", "corporate") as CorporateDataset;
    expect(blank.reports[0].fields.revenue.value).toBeNull();
    expect(parseFinancialDataset(JSON.stringify(blank)).ok).toBe(true);
    const full = sample();
    expect(parseFinancialDataset(JSON.stringify(full)).ok).toBe(true);
    expect(full.sources[0].provenance).toBe("mock");
  });
  it("normalizes scale without treating FX as unit conversion", () => {
    expect(convertUnit(1200, "million", "billion", "VND", "VND")).toBe(1.2);
    expect(convertUnit(null, "million", "unit", "VND", "VND")).toBeNull();
    expect(() => convertUnit(1, "unit", "unit", "USD", "VND")).toThrow(/currency|tiền tệ/i);
    const data = sample();
    data.reports[0].fields.revenue = { ...data.reports[0].fields.revenue, value: 1.25, unit: "billion" };
    expect(normalizeReport(data.reports[0]).values.revenue).toBe(1_250_000_000);
  });
  it("rejects unknown sources, duplicate periods, impossible dates and unsafe magnitudes", () => {
    for (const mutate of [
      (d: CorporateDataset) => { d.reports[0].fields.revenue.sourceId = "absent"; },
      (d: CorporateDataset) => { d.reports.push(d.reports[0]); },
      (d: CorporateDataset) => { d.reports[0].endDate = "2025-02-30"; },
      (d: CorporateDataset) => { d.reports[0].fields.cash.value = Number.MAX_VALUE; },
      (d: CorporateDataset) => { d.reports[0].fields.dilutedEps.unit = "million"; },
      (d: CorporateDataset) => { d.sources[0].url = "javascript:alert(1)"; },
    ]) { const d = sample(); mutate(d); expect(parseFinancialDataset(JSON.stringify(d)).ok).toBe(false); }
  });
  it("has distinct institutional schemas, not a corporate object with a changed label", () => {
    for (const industry of ["bank", "securities", "insurance"] as const) {
      expect(parseFinancialDataset(JSON.stringify(createDatasetTemplate("VCB", industry))).ok).toBe(true);
      expect(parseFinancialDataset(JSON.stringify({ ...sample(), industry })).ok).toBe(false);
    }
  });
  it("converts matching YTD flows by subtraction, retains closing stocks and cannot difference EPS", () => {
    const d = sample();
    const prior = structuredClone(d.reports[1]);
    prior.kind = "ytd"; prior.fiscalQuarter = 1; prior.endDate = "2025-03-31"; prior.publishedAt = "2025-04-30";
    const current = structuredClone(prior);
    current.id = "2025-H1"; current.fiscalQuarter = 2; current.endDate = "2025-06-30"; current.publishedAt = "2025-07-30";
    prior.fields.cfo.value = 30; current.fields.cfo.value = 90;
    prior.fields.cash.value = 10; current.fields.cash.value = 55;
    const result = convertYtdToQuarter(current, prior);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.values.cfo).toBe(60_000_000);
      expect(result.value.values.cash).toBe(55_000_000);
      expect(result.value.values.dilutedEps).toBeNull();
      expect(result.value.startDate).toBe("2025-04-01");
      expect(result.value.derivation?.inputs.filter(i => i.key === "cfo").map(i => i.periodId)).toEqual([current.id, prior.id]);
    }
    prior.scope = "standalone";
    expect(convertYtdToQuarter(current, prior).ok).toBe(false);
  });
  it("requires a matching immediately preceding YTD and does not coerce missing to zero", () => {
    const d = sample(); const current = structuredClone(d.reports[1]);
    current.kind = "ytd"; current.fiscalQuarter = 3; current.endDate = "2025-09-30";
    expect(convertYtdToQuarter(current, null).ok).toBe(false);
    const prior = structuredClone(current); prior.fiscalQuarter = 2; prior.endDate = "2025-06-30";
    current.fields.cfo.value = null;
    const result = convertYtdToQuarter(current, prior);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.values.cfo).toBeNull();
  });
  it("supports non-December year ends but rejects inconsistent report calendars", () => {
    const d = sample(); d.fiscalYearEndMonth = 6;
    for (const p of d.reports) { p.startDate = `${p.fiscalYear - 1}-07-01`; p.endDate = `${p.fiscalYear}-06-30`; }
    expect(parseFinancialDataset(JSON.stringify(d)).ok).toBe(true);
    d.reports[1].startDate = "2025-01-01";
    expect(parseFinancialDataset(JSON.stringify(d)).ok).toBe(false);
  });
  it("subtracts normalized YTD flows across scales, while Q1 is already a quarter", () => {
    const p = structuredClone(sample().reports[1]);
    p.kind = "ytd"; p.fiscalQuarter = 1; p.endDate = "2025-03-31";
    p.fields.cfo.value = 30;
    const q = structuredClone(p); q.id = "H1"; q.fiscalQuarter = 2; q.endDate = "2025-06-30";
    q.fields.cfo.value = .09; q.fields.cfo.unit = "billion";
    const difference = convertYtdToQuarter(q, p), first = convertYtdToQuarter(p, null);
    expect(difference.ok && difference.value.values.cfo).toBe(60_000_000);
    expect(first.ok && first.value.values.cfo).toBe(30_000_000);
    expect(first.ok && first.value.values.dilutedEps).toBe(p.fields.dilutedEps.value);
    q.basis = "restated differently";
    expect(convertYtdToQuarter(q, p).ok).toBe(false);
  });
});
