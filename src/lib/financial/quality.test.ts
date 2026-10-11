import { describe, expect, it } from "vitest";
import { assessDataQuality, DATA_CLASSIFICATIONS } from "./quality";
import { createDatasetTemplate, parseFinancialDataset } from "./schema";
import { analyzeRatios } from "./ratios";
import type { CorporateDataset, CorporateReport } from "./types";

const fixture = () => createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
const codes = (data: CorporateDataset) => assessDataQuality(data).issues.map(issue => issue.code);
const interim = (base: CorporateReport, kind: "quarter" | "ytd", quarter: 1 | 2 | 3 | 4): CorporateReport => ({
  ...structuredClone(base), id: `${kind}${quarter}`, kind, fiscalQuarter: quarter,
  startDate: kind === "quarter" ? `2025-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01` : "2025-01-01",
  endDate: ["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"][quarter - 1],
});

describe("data quality provenance and missing data", () => {
  it("never promotes parsed or audited user input to verified, and retains mixed origins per field", () => {
    const data = fixture();
    data.sources.push({ ...data.sources[0], id: "USER", provenance: "user_supplied", title: "BCTC người dùng nhập", url: "https://example.com/report.pdf" });
    data.reports[1].audited = "audited";
    data.reports[1].fields.revenue.sourceId = "USER";
    const parsed = parseFinancialDataset(JSON.stringify(data));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("fixture must parse");
    const report = assessDataQuality(parsed.value);
    expect(report.sourceOrigins).toEqual(["MOCK", "USER_SUPPLIED_UNVERIFIED"]);
    expect(DATA_CLASSIFICATIONS).toEqual(["MOCK", "USER_SUPPLIED_UNVERIFIED", "CALCULATED", "ASSUMPTION", "AI_INTERPRETATION"]);
    expect(report.verification).toBe("not_performed");
    expect(report.fieldLineage.find(field => field.path === "reports[1].fields.revenue")).toMatchObject({
      origin: "USER_SUPPLIED_UNVERIFIED", rawValue: 1200, normalizedValue: 1_200_000_000,
      unit: "million", currency: "VND", sourceId: "USER", sourceStatus: "resolved",
      source: { title: "BCTC người dùng nhập", url: "https://example.com/report.pdf" },
      period: { id: "FY2025", kind: "annual", publishedAt: "2026-03-31", audited: "audited" },
    });
    expect(report.fieldLineage.find(field => field.path === "reports[1].fields.cfo")?.origin).toBe("MOCK");
    expect(report.fieldLineage.find(field => field.path === "market.sharesOutstanding")).toMatchObject({ normalizedValue: 100_000, currency: null, dimension: "shares" });
  });

  it("reports missing fields and unavailable ratios without imputing zero", () => {
    const data = fixture();
    data.reports[1].fields.revenue.value = null;
    data.market = null;
    const report = assessDataQuality(data, { reportId: "FY2025" });
    expect(report.missingInputs).toEqual(expect.arrayContaining(["reports[1].fields.revenue", "market"]));
    expect(report.fieldLineage.find(field => field.path === "reports[1].fields.revenue")?.normalizedValue).toBeNull();
    expect(report.unavailableMetrics.find(metric => metric.metricId === "grossMargin")).toMatchObject({ reportId: "FY2025", code: "missing_data" });
    expect(report.unavailableMetrics.find(metric => metric.metricId === "pe")).toBeDefined();
    expect(data.reports[1].fields.revenue.value).toBeNull();
  });

  it("keeps bank lineage while classifying corporate ratios as unsupported", () => {
    const report = assessDataQuality(createDatasetTemplate("VCB", "bank"));
    expect(report.fieldLineage.find(field => field.path === "reports[0].bank.riskWeightedAssets")).toMatchObject({ origin: "USER_SUPPLIED_UNVERIFIED", normalizedValue: null });
    expect(report.unavailableMetrics.length).toBeGreaterThan(0);
    expect(report.unavailableMetrics.every(metric => metric.code === "unsupported")).toBe(true);
  });

  it("does not silently resolve duplicate or unknown source IDs", () => {
    const data = fixture();
    data.sources.push({ ...data.sources[0], provenance: "user_supplied" });
    data.reports[1].fields.revenue.sourceId = "NOT_FOUND";
    const report = assessDataQuality(data);
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["duplicate_source_id", "missing_source"]));
    expect(report.fieldLineage[0]).toMatchObject({ sourceStatus: "ambiguous", source: null, origin: null });
    expect(report.fieldLineage.find(field => field.path === "reports[1].fields.revenue")).toMatchObject({ sourceStatus: "missing", source: null, origin: null });
  });
});

describe("data quality period, source, basis and unit anomalies", () => {
  it("detects duplicate report IDs, periods and source URLs without choosing a version", () => {
    const data = fixture();
    data.sources[0].url = "https://example.com/report.pdf";
    data.sources.push({ ...data.sources[0], id: "OTHER" });
    data.reports.push(structuredClone(data.reports[1]));
    const report = assessDataQuality(data, { reportId: "FY2025" });
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["duplicate_source_url", "duplicate_report_id", "duplicate_period"]));
    expect(report.unavailableMetrics.every(metric => metric.code === "invalid")).toBe(true);
  });

  it("reports basis changes and competing restatement versions explicitly", () => {
    const data = fixture();
    data.reports[0].basis = "Bản trước điều chỉnh";
    const revised = structuredClone(data.reports[1]);
    revised.id = "FY2025_RESTATED";
    revised.basis = "Đã điều chỉnh";
    data.reports.push(revised);
    expect(codes(data)).toEqual(expect.arrayContaining(["basis_change", "competing_period_versions"]));
  });

  it("checks publication, access, as-of and fiscal calendar without using the current clock", () => {
    const data = fixture();
    data.reports[0].publishedAt = "2024-11-30";
    data.reports[1].endDate = "2025-12-30";
    data.sources[0].accessedAt = "2026-02-01";
    const report = assessDataQuality(data, { asOf: "2026-03-01" });
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      "publication_before_period_end", "source_access_before_publication", "publication_after_asof", "market_after_asof", "period_calendar_mismatch",
    ]));
    expect(assessDataQuality(fixture()).issues.some(issue => issue.code.endsWith("after_asof"))).toBe(false);
  });

  it("normalizes valid scale differences but flags invalid per-share units and unsafe values", () => {
    const data = fixture();
    data.reports[1].fields.revenue = { ...data.reports[1].fields.revenue, value: 1.2, unit: "billion" };
    let report = assessDataQuality(data);
    expect(report.fieldLineage.find(field => field.path === "reports[1].fields.revenue")?.normalizedValue).toBe(1_200_000_000);
    expect(report.issues.find(issue => issue.code === "unit_scale_change")?.severity).toBe("info");
    expect(report.issues.some(issue => issue.code === "accounting_inconsistency")).toBe(false);
    data.reports[1].fields.dilutedEps.unit = "million";
    data.reports[1].fields.revenue.value = Number.MAX_SAFE_INTEGER;
    report = assessDataQuality(data);
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["per_share_unit", "unsafe_normalized_value"]));
    expect(report.unavailableMetrics.every(metric => metric.code === "invalid")).toBe(true);
  });
});

describe("cross-statement cash plausibility", () => {
  it("reconciles compatible cash values but never labels a matching equation verified", () => {
    const report = assessDataQuality(fixture(), { reportId: "FY2025" });
    expect(report.cashReconciliations.find(item => item.reportId === "FY2025")).toMatchObject({ status: "checked", residual: 0, contentLayer: "CALCULATED", openingReportIds: ["FY2024"] });
    expect(report.issues.some(issue => issue.code === "cash_flow_residual")).toBe(false);
  });

  it("treats an unexplained residual as a warning because FX and reclassifications are not modeled", () => {
    const data = fixture();
    data.reports[1].fields.cash.value = 170;
    const report = assessDataQuality(data, { reportId: "FY2025" });
    expect(report.cashReconciliations[1]).toMatchObject({ residual: 20_000_000, status: "checked" });
    expect(report.issues.find(issue => issue.code === "cash_flow_residual")).toMatchObject({ severity: "warning" });
    expect(report.issues.find(issue => issue.code === "cash_flow_residual")?.message).toContain("tỷ giá");
    expect(report.unavailableMetrics.find(metric => metric.metricId === "grossMargin")).toBeUndefined();
  });

  it("uses period-start cash: quarter opening differs from YTD opening", () => {
    const data = fixture();
    const q1 = interim(data.reports[1], "quarter", 1);
    q1.fields.cash.value = 130;
    const q2 = interim(data.reports[1], "quarter", 2);
    q2.fields.cash.value = 150;
    q2.fields.cfo.value = 40;
    q2.fields.cfi.value = -10;
    q2.fields.cff.value = -10;
    const ytd2 = interim(data.reports[1], "ytd", 2);
    data.reports = [data.reports[0], q1, q2, ytd2];
    const report = assessDataQuality(data);
    expect(report.cashReconciliations.find(item => item.reportId === "quarter2")).toMatchObject({ openingReportIds: ["quarter1"], residual: 0 });
    expect(report.cashReconciliations.find(item => item.reportId === "ytd2")).toMatchObject({ openingReportIds: ["FY2024"], residual: 0 });
    expect(report.issues.some(issue => issue.code === "duplicate_period")).toBe(false);
  });

  it("does not reconcile against an arbitrarily selected same-date opening balance", () => {
    const data = fixture();
    const duplicate = structuredClone(data.reports[0]);
    duplicate.id = "Q4_2024";
    duplicate.kind = "quarter";
    duplicate.fiscalQuarter = 4;
    duplicate.startDate = "2024-10-01";
    duplicate.fields.cash.value = 105;
    data.reports.unshift(duplicate);
    const first = assessDataQuality(data);
    data.reports.reverse();
    const reversed = assessDataQuality(data);
    for (const report of [first, reversed]) {
      expect(report.cashReconciliations.find(item => item.reportId === "FY2025")).toMatchObject({ status: "skipped", residual: null, reason: "ambiguous_opening_balance" });
      expect(report.issues.some(issue => issue.code === "conflicting_closing_balances")).toBe(true);
    }
  });

  it("skips missing or incompatible opening data rather than treating it as zero", () => {
    const data = fixture();
    data.reports[0].scope = "standalone";
    let report = assessDataQuality(data);
    expect(report.cashReconciliations.find(item => item.reportId === "FY2025")).toMatchObject({ status: "skipped", residual: null, reason: "missing_opening_balance" });
    data.reports[0].scope = "consolidated";
    data.reports[1].fields.cfi.value = null;
    report = assessDataQuality(data);
    expect(report.cashReconciliations.find(item => item.reportId === "FY2025")).toMatchObject({ status: "skipped", residual: null, reason: "missing_cash_inputs" });
  });
});

describe("quality alignment with explicit restatement selection", () => {
  function revisedFixture() {
    const data = fixture();
    const revised = structuredClone(data.reports[0]);
    revised.id = "RESTATED_2024";
    revised.restatement = { status: "restated" as const, revision: "v2", note: "Tiền đầu kỳ được điều chỉnh theo thuyết minh" };
    revised.fields.cash.value = 110;
    data.reports.push(revised);
    return data;
  }

  it("uses the explicit revision consistently with ratios and preserves its lineage", () => {
    const data = revisedFixture();
    data.reports[1].openingReportId = "RESTATED_2024";
    expect(parseFinancialDataset(JSON.stringify(data)).ok).toBe(true);
    for (const reports of [data.reports, [...data.reports].reverse()]) {
      const dataset = { ...data, reports };
      const quality = assessDataQuality(dataset, { reportId: "FY2025" });
      const unavailable = analyzeRatios(dataset, "FY2025").filter(metric => !metric.result.ok).map(metric => metric.id);
      expect(quality.unavailableMetrics.map(metric => metric.metricId)).toEqual(unavailable);
      expect(quality.unavailableMetrics.some(metric => metric.metricId === "roe")).toBe(false);
      expect(quality.issues.some(issue => issue.code === "duplicate_period")).toBe(false);
      expect(quality.issues.find(issue => issue.code === "competing_period_versions")?.severity).toBe("warning");
      expect(quality.cashReconciliations.find(item => item.reportId === "FY2025")).toMatchObject({
        status: "checked", openingReportIds: ["RESTATED_2024"], deltaCash: 40_000_000, residual: -10_000_000,
      });
      const current = quality.fieldLineage.find(field => field.period?.id === "FY2025")!;
      const revised = quality.fieldLineage.find(field => field.period?.id === "RESTATED_2024")!;
      expect(current.period?.openingReportId).toBe("RESTATED_2024");
      expect(revised.period?.restatement).toEqual(data.reports[2].restatement);
      revised.period!.restatement!.note = "Mutated output only";
      expect(data.reports[2].restatement?.note).toBe("Tiền đầu kỳ được điều chỉnh theo thuyết minh");
    }
  });

  it("blocks only metrics requiring an unresolved version rather than every calculation", () => {
    const data = revisedFixture();
    const quality = assessDataQuality(data, { reportId: "FY2025" });
    expect(quality.issues.some(issue => issue.code === "duplicate_period")).toBe(false);
    expect(quality.unavailableMetrics.find(metric => metric.metricId === "grossMargin")).toBeUndefined();
    expect(quality.unavailableMetrics.find(metric => metric.metricId === "roe")).toMatchObject({ code: "incompatible" });
    expect(quality.cashReconciliations.find(item => item.reportId === "FY2025")).toMatchObject({ status: "skipped", reason: "ambiguous_opening_balance", residual: null });
  });

  it.each(["unknown", "scope", "basis", "date"] as const)("rejects an explicit %s mismatch without falling back to another opening", mismatch => {
    const data = revisedFixture();
    const revised = data.reports[2];
    data.reports[1].openingReportId = mismatch === "unknown" ? "MISSING" : revised.id;
    if (mismatch === "scope") revised.scope = "standalone";
    if (mismatch === "basis") revised.basis = "Different basis";
    if (mismatch === "date") Object.assign(revised, { fiscalYear: 2023, startDate: "2023-01-01", endDate: "2023-12-31" });
    const quality = assessDataQuality(data, { reportId: "FY2025" });
    expect(quality.cashReconciliations.find(item => item.reportId === "FY2025")).toMatchObject({ status: "skipped", reason: "invalid_opening_selection", residual: null });
    expect(quality.issues.find(issue => issue.code === "invalid_opening_selection")?.reportIds).toContain("FY2025");
    expect(quality.unavailableMetrics.find(metric => metric.metricId === "roe")?.code).toBe("incompatible");
  });

  it("still rejects a duplicate period that reuses the same revision identifier", () => {
    const data = revisedFixture();
    const copy = structuredClone(data.reports[2]);
    copy.id = "DUPLICATE_V2";
    data.reports.push(copy);
    expect(parseFinancialDataset(JSON.stringify(data)).ok).toBe(false);
    const quality = assessDataQuality(data, { reportId: "FY2025" });
    expect(quality.issues.find(issue => issue.code === "duplicate_period")).toMatchObject({ severity: "error", reportIds: ["RESTATED_2024", "DUPLICATE_V2"] });
    expect(quality.unavailableMetrics.every(metric => metric.code === "invalid")).toBe(true);
  });
});
