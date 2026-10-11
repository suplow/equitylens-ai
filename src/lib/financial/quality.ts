import { accountingIssues, analyzeRatios, RATIO_DEFINITIONS } from "./ratios";
import { resolveOpening, validPeriod } from "./periods";
import { expectedPeriodDates, factValue, UNIT_SCALE } from "./schema";
import { BALANCE_FIELDS, type CorporateDataset, type CorporateReport, type Currency, type Fact, type FinancialDataset, type FinancialSource, type InputEvidence, type IssueCode, type PeriodMetadata, type Unit } from "./types";

/** Origin and content layer are separate axes; none implies external verification. */
export const DATA_CLASSIFICATIONS = ["MOCK", "USER_SUPPLIED_UNVERIFIED", "CALCULATED", "ASSUMPTION", "AI_INTERPRETATION"] as const;
export type SourceOrigin = "MOCK" | "USER_SUPPLIED_UNVERIFIED";
export interface QualityIssue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  paths: string[];
  reportIds: string[];
}
export interface FieldLineage {
  path: string;
  field: string;
  rawValue: number | null;
  normalizedValue: number | null;
  unit: Unit;
  currency: Currency | null;
  dimension: "money" | "money_per_share" | "shares";
  sourceId: string;
  sourceStatus: "resolved" | "missing" | "ambiguous";
  source: FinancialSource | null;
  origin: SourceOrigin | null;
  locator: string;
  period: PeriodMetadata | null;
  marketAsOf: string | null;
}
export interface UnavailableMetric {
  reportId: string;
  metricId: string;
  label: string;
  code: IssueCode;
  reasons: string[];
  inputs: InputEvidence[];
  contentLayer: "CALCULATED";
}
export interface CashReconciliation {
  reportId: string;
  openingReportIds: string[];
  contentLayer: "CALCULATED";
  status: "checked" | "skipped";
  reason?: "missing_opening_balance" | "ambiguous_opening_balance" | "invalid_opening_selection" | "missing_cash_inputs" | "invalid_input";
  deltaCash: number | null;
  netCashFlow: number | null;
  residual: number | null;
  tolerance: number | null;
}
export interface DataQualityReport {
  symbol: string;
  verification: "not_performed";
  sourceOrigins: SourceOrigin[];
  classificationGuide: { label: typeof DATA_CLASSIFICATIONS[number]; meaning: string }[];
  fieldLineage: FieldLineage[];
  missingInputs: string[];
  unavailableMetrics: UnavailableMetric[];
  cashReconciliations: CashReconciliation[];
  issues: QualityIssue[];
  limitations: string[];
}
export interface QualityOptions { reportId?: string; asOf?: string }

type Report = FinancialDataset["reports"][number];
function reportFields(report: Report): { group: string; fields: Record<string, Fact> } {
  if ("fields" in report) return { group: "fields", fields: report.fields };
  if ("bank" in report) return { group: "bank", fields: report.bank };
  if ("securities" in report) return { group: "securities", fields: report.securities };
  return { group: "insurance", fields: report.insurance };
}
function metadata(report: Report): PeriodMetadata {
  const { id, kind, fiscalYear, fiscalQuarter, startDate, endDate, scope, audited, publishedAt, basis, openingReportId, restatement } = report;
  return { id, kind, fiscalYear, fiscalQuarter, startDate, endDate, scope, audited, publishedAt, basis,
    ...(openingReportId !== undefined ? { openingReportId } : {}),
    ...(restatement ? { restatement: { ...restatement } } : {}) };
}
function groups<T>(items: T[], key: (item: T) => string): T[][] {
  const map = new Map<string, T[]>();
  for (const item of items) { const value = key(item); map.set(value, [...(map.get(value) ?? []), item]); }
  return [...map.values()];
}
function normalized(fact: Fact): number | null {
  try { return factValue(fact); } catch { return null; }
}
function isDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function precedingDate(value: string): string | null {
  return isDate(value) ? new Date(Date.parse(`${value}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : null;
}
function roundingTolerance(facts: Fact[], values: number[]): number {
  return Math.max(facts.reduce((total, fact) => total + UNIT_SCALE[fact.unit] / 2, 0), Math.max(...values.map(Math.abs)) * 1e-9);
}

/** Diagnostic only: use parseFinancialDataset at the input boundary; this does not verify source truth. */
export function assessDataQuality(data: FinancialDataset, options: QualityOptions = {}): DataQualityReport {
  const issues: QualityIssue[] = [], fieldLineage: FieldLineage[] = [], missingInputs: string[] = [];
  const add = (code: string, severity: QualityIssue["severity"], message: string, paths: string[] = [], reportIds: string[] = []) => {
    issues.push({ code, severity, message, paths, reportIds });
  };
  const sourcesById = new Map(groups(data.sources, source => source.id).map(sources => [sources[0].id, sources]));
  for (const sources of sourcesById.values()) if (sources.length > 1) add("duplicate_source_id", "error", `ID nguồn ${sources[0].id} bị lặp; không tự chọn một nguồn.`, ["sources"]);
  for (const sources of groups(data.sources.filter(source => source.url.trim()), source => source.url.trim())) {
    if (sources.length > 1) add("duplicate_source_url", "warning", `Các ID ${sources.map(source => source.id).join(", ")} dùng cùng URL; kiểm tra trùng tài liệu hoặc URL trang tổng hợp.`, ["sources"]);
  }
  for (const source of data.sources) {
    if (!source.url) add("source_url_missing", "info", `Nguồn ${source.id} chưa có URL; cần giữ tài liệu gốc và vị trí trích dẫn để đối chiếu.`, ["sources"]);
    if (options.asOf && isDate(options.asOf) && source.accessedAt > options.asOf) add("source_access_after_asof", "warning", `Nguồn ${source.id} được truy cập sau ngày đánh giá.`, ["sources"]);
  }
  if (options.asOf && !isDate(options.asOf)) add("invalid_asof", "error", "Ngày đánh giá phải có dạng YYYY-MM-DD hợp lệ.");

  function appendFact(fact: Fact, field: string, path: string, period: PeriodMetadata | null, marketAsOf: string | null) {
    const matches = sourcesById.get(fact.sourceId) ?? [];
    const source = matches.length === 1 ? matches[0] : null;
    const sourceStatus = matches.length === 1 ? "resolved" : matches.length ? "ambiguous" : "missing";
    const normalizedValue = normalized(fact);
    const reportIds = period ? [period.id] : [];
    if (!matches.length) add("missing_source", "error", `${path}: không tìm thấy nguồn ${fact.sourceId}.`, [path], reportIds);
    if (fact.value === null) missingInputs.push(path);
    else if (normalizedValue === null) add("unsafe_normalized_value", "error", `${path}: không thể chuẩn hóa trong phạm vi số an toàn.`, [path], reportIds);
    if (["price", "dilutedEps"].includes(field) && fact.unit !== "unit") add("per_share_unit", "error", `${path}: giá/EPS phải dùng tiền trên cổ phiếu, unit; không dùng nghìn/triệu/tỷ.`, [path], reportIds);
    if (!fact.locator.trim()) add("source_locator_missing", "warning", `${path}: thiếu trang/bảng trong nguồn.`, [path], reportIds);
    fieldLineage.push({ path, field, rawValue: fact.value, normalizedValue, unit: fact.unit,
      currency: field === "sharesOutstanding" ? null : data.currency,
      dimension: field === "sharesOutstanding" ? "shares" : ["price", "dilutedEps"].includes(field) ? "money_per_share" : "money",
      sourceId: fact.sourceId, sourceStatus, source: source ? { ...source } : null,
      origin: source ? source.provenance === "mock" ? "MOCK" : "USER_SUPPLIED_UNVERIFIED" : null,
      locator: fact.locator, period, marketAsOf });
  }

  data.reports.forEach((report, index) => {
    const path = `reports[${index}]`, { group, fields } = reportFields(report);
    for (const [field, fact] of Object.entries(fields)) appendFact(fact, field, `${path}.${group}.${field}`, metadata(report), null);
    const dates = expectedPeriodDates(report, data.fiscalYearEndMonth);
    if (report.startDate !== dates.startDate || report.endDate !== dates.endDate || (report.kind === "annual") !== (report.fiscalQuarter === null)) add("period_calendar_mismatch", "error", `${report.id}: loại kỳ/ngày không khớp lịch tài chính.`, [path], [report.id]);
    if (report.publishedAt < report.endDate) add("publication_before_period_end", "error", `${report.id}: ngày công bố trước ngày cuối kỳ.`, [`${path}.publishedAt`], [report.id]);
    if (options.asOf && isDate(options.asOf) && report.publishedAt > options.asOf) add("publication_after_asof", "warning", `${report.id}: công bố sau ngày đánh giá; không phải dữ liệu sẵn có tại thời điểm đó.`, [`${path}.publishedAt`], [report.id]);
    const referenced = new Set(Object.values(fields).map(fact => fact.sourceId));
    for (const sourceId of referenced) {
      const source = sourcesById.get(sourceId);
      if (source?.length === 1 && source[0].accessedAt < report.publishedAt) add("source_access_before_publication", "warning", `${report.id}: ngày truy cập ${sourceId} trước ngày công bố; kiểm tra phiên bản/ngày nguồn.`, [path, "sources"], [report.id]);
    }
    if (!report.basis.trim()) add("basis_missing", "error", `${report.id}: thiếu cơ sở kế toán/điều chỉnh.`, [`${path}.basis`], [report.id]);
  });
  if (data.market) {
    for (const field of ["price", "sharesOutstanding"] as const) appendFact(data.market[field], field, `market.${field}`, null, data.market.asOf);
    if (options.asOf && isDate(options.asOf) && data.market.asOf > options.asOf) add("market_after_asof", "warning", "Ngày giá/số cổ phiếu sau ngày đánh giá.", ["market.asOf"]);
    const selected = data.reports.filter(report => !options.reportId || report.id === options.reportId);
    for (const report of selected) {
      if (data.market.asOf < report.publishedAt) add("market_before_publication", "warning", `${report.id}: ngày thị trường trước công bố; không ghép để định giá như thông tin đã biết.`, ["market.asOf"], [report.id]);
      if (data.market.basis !== report.basis) add("market_basis_mismatch", "warning", `${report.id}: cơ sở giá/cổ phiếu khác báo cáo; cần đối chiếu corporate actions.`, ["market.basis"], [report.id]);
    }
  } else missingInputs.push("market");

  for (const reports of groups<PeriodMetadata>(data.reports, report => report.id)) if (reports.length > 1) add("duplicate_report_id", "error", `ID kỳ ${reports[0].id} bị lặp.`, ["reports"], [reports[0].id]);
  for (const reports of groups<PeriodMetadata>(data.reports, report => `${report.kind}|${report.startDate}|${report.endDate}|${report.scope}`)) {
    if (reports.length < 2) continue;
    const ids = reports.map(report => report.id);
    // Match the input schema: distinct declared revisions may coexist; reusing one may not.
    for (const revisions of groups(reports, report => report.restatement?.revision ?? "original")) {
      if (revisions.length > 1) add("duplicate_period", "error", `${revisions.map(report => report.id).join(", ")}: trùng loại kỳ/ngày/phạm vi và mã revision.`, ["reports"], revisions.map(report => report.id));
    }
    add("competing_period_versions", "warning", `${ids.join(", ")}: nhiều bản báo cáo cùng kỳ/phạm vi. Chọn rõ ID kỳ và openingReportId khi cần số dư đầu kỳ; không tự ưu tiên bản mới hoặc suy ra basis tương thích.`, ["reports"], ids);
  }
  for (const reports of groups<PeriodMetadata>(data.reports, report => report.scope)) {
    if (new Set(reports.map(report => report.basis)).size > 1) add("basis_change", "warning", "Các báo cáo cùng phạm vi có basis khác nhau; phải đối chiếu điều chỉnh trước khi so sánh.", ["reports"], reports.map(report => report.id));
  }
  for (const fields of groups(fieldLineage.filter(field => field.period), field => `${field.period!.scope}|${field.field}`)) {
    if (new Set(fields.map(field => field.unit)).size > 1) add("unit_scale_change", "info", `${fields[0].field}: đơn vị trình bày thay đổi giữa các kỳ; đã đổi thang đo, chưa đổi tiền tệ.`, fields.map(field => field.path), [...new Set(fields.map(field => field.period!.id))]);
  }

  const cashReconciliations: CashReconciliation[] = [];
  if (data.industry === "corporate") {
    for (const report of data.reports) {
      if (Object.values(report.fields).every(fact => fact.value === null || normalized(fact) !== null)) {
        for (const message of accountingIssues(report)) add("accounting_inconsistency", "warning", message, ["reports"], [report.id]);
      }
    }
    for (const reports of groups(data.reports, report => `${report.endDate}|${report.scope}|${report.basis}`)) {
      if (reports.length < 2) continue;
      const conflicting = BALANCE_FIELDS.filter(field => {
        const values = reports.map(report => normalized(report.fields[field])).filter((value): value is number => value !== null);
        const facts = reports.filter(report => normalized(report.fields[field]) !== null).map(report => report.fields[field]);
        return values.length > 1 && Math.max(...values) - Math.min(...values) > roundingTolerance(facts, values);
      });
      if (conflicting.length) add("conflicting_closing_balances", "warning", `Số dư cùng ngày/phạm vi/basis không khớp: ${conflicting.join(", ")}. Không tự chọn theo loại báo cáo.`, ["reports"], reports.map(report => report.id));
    }
    for (const report of data.reports) cashReconciliations.push(reconcileCash(report, data, add));
  }

  const unavailableMetrics: UnavailableMetric[] = [];
  const reportIds = options.reportId ? [options.reportId] : [...new Set(data.reports.map(report => report.id))];
  const structuralErrors = issues.filter(issue => issue.severity === "error");
  for (const reportId of reportIds) {
    if (structuralErrors.length) {
      for (const metric of RATIO_DEFINITIONS) unavailableMetrics.push({ reportId, metricId: metric.id, label: metric.label, code: "invalid", reasons: structuralErrors.map(issue => issue.message), inputs: [], contentLayer: "CALCULATED" });
      continue;
    }
    for (const metric of analyzeRatios(data, reportId)) if (!metric.result.ok) unavailableMetrics.push({ reportId, metricId: metric.id, label: metric.label, code: metric.result.code, reasons: [...metric.result.issues], inputs: structuredClone(metric.inputs), contentLayer: "CALCULATED" });
  }
  const sourceOrigins = (["MOCK", "USER_SUPPLIED_UNVERIFIED"] as const).filter(origin => data.sources.some(source => (source.provenance === "mock" ? "MOCK" : "USER_SUPPLIED_UNVERIFIED") === origin));
  return { symbol: data.symbol, verification: "not_performed", sourceOrigins,
    classificationGuide: [
      { label: "MOCK", meaning: "Dữ liệu luyện tập; không dùng làm dữ kiện của cổ phiếu thực." },
      { label: "USER_SUPPLIED_UNVERIFIED", meaning: "Dữ liệu người dùng nhập; chưa đối chiếu tài liệu gốc, kể cả khi khai báo đã kiểm toán." },
      { label: "CALCULATED", meaning: "Kết quả công thức xác định; chất lượng vẫn phụ thuộc đầu vào." },
      { label: "ASSUMPTION", meaning: "Giả định do người dùng/nhà phân tích lựa chọn; không phải dữ kiện công bố." },
      { label: "AI_INTERPRETATION", meaning: "Diễn giải của AI; cần kiểm tra nguồn và lập luận." },
    ], fieldLineage, missingInputs, unavailableMetrics, cashReconciliations, issues,
    limitations: [
      "Không đối chiếu nội dung URL, quyền sử dụng, báo cáo gốc hay sự thật của số liệu. Zod và phương trình khớp không xác minh đầu vào.",
      "basis và restatement (status, revision, note) là khai báo của người dùng; chưa xác minh bản điều chỉnh, ngày hiệu lực hay tác động lên từng chỉ tiêu. Không suy ra bản mới đúng hơn hoặc tương thích chỉ từ nhãn revision.",
      "openingReportId chỉ chọn số dư đầu kỳ cùng ngày/phạm vi/basis/lịch tài chính. Nó không tự chọn kỳ tăng trưởng, phiên bản lịch sử CAGR hoặc giải quyết các so sánh khác.",
      "Chênh lệch tiền chỉ là kiểm tra hợp lý: chưa có ảnh hưởng tỷ giá, tái phân loại và đối chiếu phạm vi tiền. Không tự điền các khoản này bằng 0.",
      "Không tạo giả định hoặc diễn giải AI. Danh mục nhãn mô tả cách phân loại; không chứng tỏ các lớp đó có dữ liệu trong báo cáo này.",
      "Không tự annualize, đổi tiền tệ hoặc chọn bản báo cáo thay người dùng. asOf chỉ được kiểm tra khi caller cung cấp; không dùng đồng hồ hệ thống.",
    ] };
}

function reconcileCash(report: CorporateReport, data: CorporateDataset, add: (code: string, severity: QualityIssue["severity"], message: string, paths?: string[], reportIds?: string[]) => void): CashReconciliation {
  const selected = resolveOpening(data, report);
  const candidates = data.reports.filter(other => other.id !== report.id && other.endDate === precedingDate(report.startDate) && other.scope === report.scope && other.basis === report.basis && validPeriod(data, other));
  const base: CashReconciliation = { reportId: report.id, openingReportIds: selected.ok ? [selected.value.id] : candidates.map(candidate => candidate.id).sort(), contentLayer: "CALCULATED", status: "skipped", deltaCash: null, netCashFlow: null, residual: null, tolerance: null };
  if (!selected.ok) {
    if (!validPeriod(data, report)) return { ...base, reason: "invalid_input" };
    if (report.openingReportId) {
      add("invalid_opening_selection", "warning", `${report.id}: ${selected.issues.join(" ")} Không dùng bản khác thay openingReportId đã chọn.`, ["reports"], [report.id, report.openingReportId]);
      return { ...base, reason: "invalid_opening_selection" };
    }
    if (selected.code === "missing_data") return { ...base, reason: "missing_opening_balance" };
    add("ambiguous_opening_balance", "warning", `${report.id}: ${selected.issues.join(" ")}`, ["reports"], [report.id, ...base.openingReportIds]);
    return { ...base, reason: "ambiguous_opening_balance" };
  }
  const facts = [report.fields.cash, selected.value.fields.cash, report.fields.cfo, report.fields.cfi, report.fields.cff];
  if (facts.some(fact => fact.value === null)) return { ...base, reason: "missing_cash_inputs" };
  const values = facts.map(normalized);
  if (values.some(value => value === null)) return { ...base, reason: "invalid_input" };
  const [closing, opening, cfo, cfi, cff] = values as number[];
  const deltaCash = closing - opening, netCashFlow = cfo + cfi + cff, residual = deltaCash - netCashFlow;
  if ([deltaCash, netCashFlow, residual].some(value => !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) return { ...base, reason: "invalid_input" };
  const tolerance = roundingTolerance(facts, [deltaCash, netCashFlow]);
  if (Math.abs(residual) > tolerance) add("cash_flow_residual", "warning", `${report.id}: Δtiền − (CFO + CFI + CFF) = ${residual} đơn vị tiền. Cần đối chiếu tỷ giá, tái phân loại và phạm vi tiền; chưa đủ dữ liệu để kết luận sai báo cáo.`, ["reports"], [report.id, selected.value.id]);
  return { ...base, status: "checked", deltaCash, netCashFlow, residual, tolerance };
}
