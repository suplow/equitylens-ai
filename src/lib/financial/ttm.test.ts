import { describe, expect, it } from "vitest";
import { createDatasetTemplate, expectedPeriodDates, normalizeReport } from "./schema";
import { buildTtm } from "./ttm";
import { CORPORATE_FIELDS, type CorporateDataset, type CorporateReport, type FinancialDataset } from "./types";

function period(data: CorporateDataset, year: number, quarter: 1 | 2 | 3 | 4 | null, kind: CorporateReport["kind"], value: number): CorporateReport {
  const report = structuredClone(data.reports[0]);
  Object.assign(report, { id: `${year}_${kind}_${quarter ?? "FY"}`, fiscalYear: year, fiscalQuarter: quarter, kind });
  Object.assign(report, expectedPeriodDates(report, data.fiscalYearEndMonth));
  report.publishedAt = `${year + 1}-03-31`;
  for (const key of CORPORATE_FIELDS) report.fields[key] = { value, unit: "unit", sourceId: data.sources[0].id, locator: `${report.id} / ${key}` };
  return report;
}

function fourQuarters(yearEndMonth = 12) {
  const data = createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
  data.fiscalYearEndMonth = yearEndMonth;
  data.reports = [period(data, 2024, 3, "quarter", 10), period(data, 2024, 4, "quarter", 20), period(data, 2025, 1, "quarter", 30), period(data, 2025, 2, "quarter", 40)];
  return data;
}

function annualAndYtd(yearEndMonth = 12) {
  const data = createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
  data.fiscalYearEndMonth = yearEndMonth;
  data.reports = [period(data, 2024, null, "annual", 100), period(data, 2024, 2, "ytd", 40), period(data, 2025, 2, "ytd", 60)];
  return data;
}

describe("TTM from reported periods", () => {
  it("sums exactly four quarters after unit normalization and keeps closing balances", () => {
    const data = fourQuarters();
    data.reports[0].fields.revenue = { ...data.reports[0].fields.revenue, value: .01, unit: "thousand" };
    data.reports[1].fields.cfi.value = -20;
    const before = structuredClone(data);
    const result = buildTtm(data, data.reports[3].id, "quarters");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const values = normalizeReport(result.value.report).values;
    expect(values.revenue).toBe(100);
    expect(values.cfo).toBe(100);
    expect(values.capex).toBe(100);
    expect(values.cfi).toBe(60);
    expect(values.cash).toBe(40);
    expect(values.totalAssets).toBe(40);
    expect(values.dilutedEps).toBeNull();
    expect(result.value.report.startDate).toBe("2024-07-01");
    expect(result.value.report.endDate).toBe("2025-06-30");
    expect(result.value.report.kind).toBe("annual");
    expect(result.value.report.audited).toBe("unaudited");
    expect(result.warnings.join(" ")).toMatch(/EPS/);
    expect(data).toEqual(before);
  });

  it("retains original normalized source evidence and marks the calculated source as MOCK", () => {
    const data = fourQuarters();
    const result = buildTtm(data, data.reports[3].id, "quarters");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reportIds).toEqual(data.reports.map(r => r.id));
    expect(result.value.inputs.filter(i => i.key === "revenue")).toEqual(data.reports.map(r => ({ key: "revenue", value: r.fields.revenue.value, sourceId: "MOCK", locator: r.fields.revenue.locator, periodId: r.id })));
    expect(result.value.inputs.filter(i => i.key === "cash")).toHaveLength(1);
    expect(result.value.inputs.find(i => i.key === "cash")?.periodId).toBe(data.reports[3].id);
    expect(result.value.source.provenance).toBe("mock");
    expect(result.value.source.title).toMatch(/CALCULATED/);
    expect(result.value.report.fields.revenue.sourceId).toBe(result.value.source.id);
    expect(result.value.report.fields.revenue.sourceId).not.toBe("MOCK");
  });

  it("uses previous FY plus current YTD minus the comparable prior YTD", () => {
    const data = annualAndYtd();
    const result = buildTtm(data, data.reports[2].id, "fy_ytd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.report.fields.revenue.value).toBe(120);
    expect(result.value.report.fields.cfo.value).toBe(120);
    expect(result.value.report.fields.cash.value).toBe(60);
    expect(result.value.report.fields.dilutedEps.value).toBeNull();
    expect(result.value.report.startDate).toBe("2024-07-01");
    expect(result.value.report.endDate).toBe("2025-06-30");
    expect(result.value.reportIds).toEqual([data.reports[0].id, data.reports[2].id, data.reports[1].id]);
    expect(result.value.method).toContain(data.reports[0].id);
    expect(result.value.inputs.filter(i => i.key === "cfo").map(i => i.value)).toEqual([100, 60, 40]);
  });

  it.each([3, 6, 9])("honors non-December fiscal year ending in month %i", month => {
    for (const [data, method] of [[fourQuarters(month), "quarters"], [annualAndYtd(month), "fy_ytd"]] as const) {
      const anchor = data.reports.at(-1)!;
      const result = buildTtm(data, anchor.id, method);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const expectedStart = new Date(anchor.endDate + "T00:00:00Z");
      expectedStart.setUTCDate(expectedStart.getUTCDate() + 1);
      expectedStart.setUTCFullYear(expectedStart.getUTCFullYear() - 1);
      expect(result.value.report.startDate).toBe(expectedStart.toISOString().slice(0, 10));
      expect(result.value.report.endDate).toBe(anchor.endDate);
    }
  });

  it("preserves missing operands as null without dropping valid zero values", () => {
    const data = fourQuarters();
    data.reports[1].fields.revenue.value = null;
    for (const r of data.reports) r.fields.cfo.value = 0;
    const result = buildTtm(data, data.reports[3].id, "quarters");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.report.fields.revenue.value).toBeNull();
    expect(result.value.report.fields.cfo.value).toBe(0);
    expect(result.warnings.join(" ")).toMatch(/revenue|Doanh thu/);
  });

  it("blocks missing quarters and does not substitute YTD or annual values", () => {
    const data = fourQuarters();
    const anchor = data.reports[3].id;
    data.reports[1] = period(data, 2024, null, "annual", 20);
    const result = buildTtm(data, anchor, "quarters");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing_data");
  });

  it("blocks absent comparable YTD rather than subtracting a different quarter", () => {
    const data = annualAndYtd();
    data.reports[1] = period(data, 2024, 1, "ytd", 40);
    expect(buildTtm(data, data.reports[2].id, "fy_ytd").ok).toBe(false);
  });

  it.each(["scope", "basis"] as const)("blocks incompatible %s across selected periods", key => {
    const data = fourQuarters();
    if (key === "scope") data.reports[0].scope = "standalone";
    else data.reports[0].basis = "A different restatement basis";
    const result = buildTtm(data, data.reports[3].id, "quarters");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("incompatible");
  });

  it("rejects ambiguous restatement versions even when basis labels match", () => {
    const data = fourQuarters();
    const duplicate = structuredClone(data.reports[1]);
    duplicate.id = "RESTATED_Q4";
    Object.assign(duplicate, { restatement: { status: "restated", revision: "v2", note: "Second version needs explicit resolution" } });
    data.reports.push(duplicate);
    const result = buildTtm(data, data.reports[3].id, "quarters");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(" ")).toMatch(/phiên bản|mơ hồ|Trùng/);
  });

  it("rejects invalid dates, calendar changes and unknown sources", () => {
    for (const change of [
      (d: CorporateDataset) => { d.reports[0].endDate = "2024-09-31"; },
      (d: CorporateDataset) => { d.fiscalYearEndMonth = 6; },
      (d: CorporateDataset) => { d.reports[0].fields.revenue.sourceId = "UNKNOWN"; },
    ]) {
      const data = fourQuarters(); change(data);
      expect(buildTtm(data, data.reports[3].id, "quarters").ok).toBe(false);
    }
  });

  it("does not coerce non-finite input or overflowing sums into missing or valid results", () => {
    const data = fourQuarters();
    data.reports[0].fields.revenue.value = Number.NaN;
    expect(buildTtm(data, data.reports[3].id, "quarters").ok).toBe(false);
    for (const r of data.reports) r.fields.revenue.value = Number.MAX_SAFE_INTEGER / 2;
    const overflow = buildTtm(data, data.reports[3].id, "quarters");
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.code).toBe("invalid");
  });

  it("rejects FY/YTD subtraction that makes a nonnegative cash-flow convention negative", () => {
    const data = annualAndYtd(); data.reports[1].fields.capex.value = 200;
    expect(buildTtm(data, data.reports[2].id, "fy_ytd").ok).toBe(false);
  });

  it("returns typed failures for unsupported sectors, unknown anchors and the wrong method anchor", () => {
    const bank = createDatasetTemplate("VCB", "bank");
    expect(buildTtm(bank, bank.reports[0].id, "quarters")).toMatchObject({ ok: false, code: "unsupported" });
    const data = fourQuarters();
    expect(buildTtm(data, "ABSENT", "quarters")).toMatchObject({ ok: false, code: "missing_data" });
    expect(buildTtm(data, data.reports[3].id, "fy_ytd")).toMatchObject({ ok: false, code: "incompatible" });
    expect(buildTtm(null as unknown as FinancialDataset, "ABSENT", "quarters").ok).toBe(false);
  });
});
