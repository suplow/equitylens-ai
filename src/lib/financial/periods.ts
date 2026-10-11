import { expectedPeriodDates, isDate } from "./schema";
import { failure, success } from "./result";
import type { Calculation, CorporateDataset, CorporateReport } from "./types";

export function validPeriod(data: CorporateDataset, report: CorporateReport): boolean {
  if (report.derived) {
    const days = (Date.parse(report.endDate) - Date.parse(report.startDate)) / 86400000 + 1;
    return isDate(report.startDate) && isDate(report.endDate) && isDate(report.publishedAt) && report.publishedAt >= report.endDate && [365, 366].includes(days) && report.derived.reportIds.length >= 3 && report.derived.reportIds.every(id => data.reports.some(r => r.id === id && !r.derived));
  }
  const dates = expectedPeriodDates(report, data.fiscalYearEndMonth);
  return isDate(report.startDate) && isDate(report.endDate) && isDate(report.publishedAt) && report.publishedAt >= report.endDate
    && dates.startDate === report.startDate && dates.endDate === report.endDate
    && ((report.kind === "annual") === (report.fiscalQuarter === null));
}
export function resolveOpening(data: CorporateDataset, report: CorporateReport): Calculation<CorporateReport> {
  if (!validPeriod(data, report)) return failure("incompatible", "Kỳ hiện tại không khớp lịch tài chính.");
  const end = new Date(report.startDate + "T00:00:00Z"); end.setUTCDate(end.getUTCDate() - 1);
  const candidates = data.reports.filter(r => r.id !== report.id && r.endDate === end.toISOString().slice(0, 10) && r.scope === report.scope && r.basis === report.basis && validPeriod(data, r));
  if (report.openingReportId) {
    const selected = candidates.filter(r => r.id === report.openingReportId);
    return selected.length === 1 ? success(selected[0], ["Báo cáo đầu kỳ do người dùng chọn rõ; cần đối chiếu bản điều chỉnh."]) : failure("incompatible", "openingReportId không khớp ngày đầu kỳ/scope/basis/lịch tài chính.");
  }
  if (candidates.length !== 1) return failure(candidates.length ? "incompatible" : "missing_data", candidates.length ? "Có nhiều báo cáo số dư đầu kỳ cùng ngày; cần openingReportId hợp lệ. Không tự chọn bản năm/quý/điều chỉnh." : "Thiếu báo cáo số dư ngay trước đầu kỳ cùng scope/basis.");
  return success(candidates[0]);
}
export function comparablePeriod(data: CorporateDataset, report: CorporateReport): CorporateReport | undefined {
  if (report.derived) return undefined; // No previous TTM window has been constructed.
  const candidates = data.reports.filter(r => r.kind === report.kind && r.fiscalYear === report.fiscalYear - 1 && r.fiscalQuarter === report.fiscalQuarter && r.scope === report.scope && r.basis === report.basis && validPeriod(data, r));
  return candidates.length === 1 ? candidates[0] : undefined;
}
export function compatibleAnnualHistory(data: CorporateDataset, anchor?: CorporateReport) {
  const annual = data.reports.filter(r => r.kind === "annual" && !r.derived && validPeriod(data, r)).sort((a, b) => a.endDate.localeCompare(b.endDate));
  if (!anchor) { const newest = annual.at(-1); if (!newest || annual.filter(r => r.endDate === newest.endDate).length !== 1) return []; anchor = newest; }
  const selected = annual.filter(r => r.scope === anchor.scope && r.basis === anchor.basis);
  return selected.filter(r => selected.filter(p => p.fiscalYear === r.fiscalYear).length === 1);
}
