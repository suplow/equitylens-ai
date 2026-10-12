import { parseFinancialDataset } from "../financial/schema";
import { analyzeRatios } from "../financial/ratios";
import { assessDataQuality } from "../financial/quality";
import { evaluateScenario, parseScenarios } from "../financial/valuation";

export interface FinancialEvidenceInput { datasetJson: string; reportId: string; scenariosJson?: string }

/** Recompute from validated input. Never accept externally supplied engine results. */
export function buildFinancialEvidence(input: FinancialEvidenceInput, symbol: string, bank: boolean) {
  const parsed = parseFinancialDataset(input.datasetJson);
  if (!parsed.ok) throw Error(parsed.issues.join(" "));
  const dataset = parsed.value;
  if (dataset.symbol !== symbol) throw Error("Mã bộ dữ liệu Financial Engine không khớp hồ sơ.");
  if (dataset.industry !== (bank ? "bank" : "corporate")) throw Error("Loại doanh nghiệp không khớp hồ sơ nghiên cứu.");
  const report = dataset.reports.find(r => r.id === input.reportId);
  if (!report) throw Error("Chọn đúng kỳ báo cáo Financial Engine.");
  const quality = assessDataQuality(dataset, { reportId: report.id });
  const ratios = analyzeRatios(dataset, report.id);
  const scenarios = input.scenariosJson?.trim() ? parseScenarios(input.scenariosJson) : null;
  if (scenarios && !scenarios.ok) throw Error(scenarios.issues.join(" "));
  const valuation = scenarios?.ok ? scenarios.value.map(assumptions => ({ assumptions, result: evaluateScenario(dataset, report.id, assumptions) })) : [];
  return {
    classification: "CALCULATED" as const, verification: "not_performed" as const,
    containsMock: dataset.sources.some(s => s.provenance === "mock"),
    symbol, currency: dataset.currency, report: { id: report.id, kind: report.kind, startDate: report.startDate, endDate: report.endDate, publishedAt: report.publishedAt, scope: report.scope, basis: report.basis, restatement: report.restatement },
    analysisAsOf: dataset.analysisAsOf ?? null, marketAsOf: dataset.market?.asOf ?? null,
    sources: dataset.sources, ratios, valuation, quality,
    rules: ["Percent values are fractions: 0.4 means 40%.", "Null/failed results are unavailable, never zero.", "Valuation is conditional on ASSUMPTION inputs; preserve valuation dates and blocked comparisons.", "Sources remain MOCK or USER_SUPPLIED_UNVERIFIED; calculations do not verify source documents."],
  };
}
export type FinancialEvidence = ReturnType<typeof buildFinancialEvidence>;
