import { z } from "zod";
import { BALANCE_FIELDS, CORPORATE_FIELDS, type CorporateDataset, type CorporateField, type CorporateReport, type Currency, type Fact, type FinancialDataset, type Industry, type NormalizedReport, type PeriodMetadata, type Unit, type Calculation } from "./types";
import { failure, success } from "./result";

export const MAX_DATASET_LENGTH = 1_000_000;
export const UNIT_SCALE: Record<Unit, number> = { unit: 1, thousand: 1e3, million: 1e6, billion: 1e9 };
export const FIELD_LABELS: Record<CorporateField, string> = {
  revenue: "Doanh thu", costOfRevenue: "Giá vốn", grossProfit: "Lợi nhuận gộp", operatingExpenses: "Chi phí hoạt động", ebit: "EBIT", interestExpense: "Chi phí lãi vay", pretaxIncome: "Lợi nhuận trước thuế", incomeTax: "Thuế thu nhập", netIncome: "Lợi nhuận sau thuế tổng", netIncomeToCommon: "LN thuộc cổ đông thường công ty mẹ", dilutedEps: "EPS pha loãng", depreciation: "Khấu hao & phân bổ (D&A)", cash: "Tiền và tương đương tiền", receivables: "Phải thu thương mại", inventory: "Hàng tồn kho", currentAssets: "Tài sản ngắn hạn", totalAssets: "Tổng tài sản", currentLiabilities: "Nợ ngắn hạn", shortTermDebt: "Nợ vay ngắn hạn", longTermDebt: "Nợ vay dài hạn", totalLiabilities: "Tổng nợ phải trả", shareholdersEquity: "Vốn thuộc cổ đông thường công ty mẹ", minorityInterest: "Lợi ích cổ đông không kiểm soát", preferredEquity: "Vốn cổ phần ưu đãi", nonOperatingAssets: "Tài sản ngoài hoạt động (không gồm tiền)", otherClaims: "Quyền đòi khác ngoài nợ/NCI/ưu đãi", operatingWorkingCapital: "Vốn lưu động hoạt động (không tiền/nợ vay)", cfo: "Dòng tiền hoạt động (CFO)", capex: "CAPEX (chi đầu tư, số dương)", cfi: "Dòng tiền đầu tư", cff: "Dòng tiền tài trợ",
};
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const date = z.string().refine(isDate, "Ngày phải hợp lệ và có dạng YYYY-MM-DD.");
const safeUrl = z.string().max(2000).refine(s => { if (!s) return true; try { const u = new URL(s); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }, "URL nguồn chỉ nhận HTTP(S), không có thông tin đăng nhập.");
const source = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), title: z.string().trim().min(2).max(200), url: safeUrl, accessedAt: date, provenance: z.enum(["user_supplied", "mock"]) }).strict();
const fact = z.object({ value: z.number().finite().nullable(), unit: z.enum(["unit", "thousand", "million", "billion"]), sourceId: z.string().min(1).max(40), locator: z.string().trim().min(1).max(250) }).strict();
const periodShape = {
  id: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/), kind: z.enum(["annual", "quarter", "ytd"]), fiscalYear: z.number().int().min(1900).max(2100), fiscalQuarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(), startDate: date, endDate: date,
  scope: z.enum(["consolidated", "standalone"]), audited: z.enum(["audited", "reviewed", "unaudited", "unknown"]), publishedAt: date, basis: z.string().trim().min(1).max(200),
  openingReportId: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/).optional(),
  restatement: z.object({ status: z.enum(["original", "restated"]), revision: z.string().trim().min(1).max(100), note: z.string().trim().min(1).max(500) }).strict().optional(),
};
const corporateFields = Object.fromEntries(CORPORATE_FIELDS.map(k => [k, fact])) as Record<CorporateField, typeof fact>;
const report = z.object({ ...periodShape, fields: z.object(corporateFields).strict() }).strict();
const baseShape = {
  version: z.literal("2.0"), symbol: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/), name: z.string().trim().min(1).max(200), currency: z.enum(["VND", "USD", "EUR"]), fiscalYearEndMonth: z.number().int().min(1).max(12), sources: z.array(source).min(1).max(50),
  market: z.object({ asOf: date, sharesAsOf: date.optional(), price: fact, sharesOutstanding: fact, basis: z.string().trim().min(1).max(200) }).strict().nullable(),
  analysisAsOf: date.optional(),
  corporateActions: z.object({ reviewedFrom: date, reviewedThrough: date, sourceId: z.string().min(1).max(40), events: z.array(z.object({ date, kind: z.enum(["split", "issuance", "buyback", "other"]) }).strict()).max(100) }).strict().optional(),
};
export const financialDatasetSchema = z.discriminatedUnion("industry", [
  z.object({ ...baseShape, industry: z.literal("corporate"), reports: z.array(report).min(1).max(40) }).strict(),
  z.object({ ...baseShape, industry: z.literal("bank"), reports: z.array(z.object({ ...periodShape, bank: z.object({ netInterestIncome: fact, grossLoans: fact, nonPerformingLoans: fact, regulatoryCapital: fact, riskWeightedAssets: fact }).strict() }).strict()).min(1).max(40) }).strict(),
  z.object({ ...baseShape, industry: z.literal("securities"), reports: z.array(z.object({ ...periodShape, securities: z.object({ brokerageRevenue: fact, tradingAssets: fact, clientMoney: fact }).strict() }).strict()).min(1).max(40) }).strict(),
  z.object({ ...baseShape, industry: z.literal("insurance"), reports: z.array(z.object({ ...periodShape, insurance: z.object({ insuranceRevenue: fact, claimsExpense: fact, insuranceLiabilities: fact }).strict() }).strict()).min(1).max(40) }).strict(),
]);

/** Scale conversion only. FX must never silently behave like a scale multiplier. */
export function convertUnit(value: number | null, from: Unit, to: Unit, fromCurrency: Currency, toCurrency: Currency): number | null {
  if (fromCurrency !== toCurrency) throw new Error("Khác tiền tệ: cần tỷ giá, ngày và phương pháp riêng; không tự chuyển currency.");
  if (value === null) return null;
  const converted = value * UNIT_SCALE[from] / UNIT_SCALE[to];
  if (!Number.isFinite(converted) || Math.abs(converted) > Number.MAX_SAFE_INTEGER) throw new Error("Giá trị sau chuẩn hóa vượt phạm vi số an toàn.");
  return converted;
}
export function factValue(f: Fact): number | null { return convertUnit(f.value, f.unit, "unit", "VND", "VND"); }
export function normalizeReport(r: CorporateReport): NormalizedReport {
  const { fields, ...metadata } = r;
  return { ...metadata, values: Object.fromEntries(CORPORATE_FIELDS.map(k => [k, factValue(fields[k])])) as NormalizedReport["values"], facts: structuredClone(fields) };
}
function iso(year: number, month: number, day: number) { return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10); }
export function expectedPeriodDates(p: Pick<PeriodMetadata, "fiscalYear" | "fiscalQuarter" | "kind">, yearEndMonth: number) {
  const fyStartYear = yearEndMonth === 12 ? p.fiscalYear : p.fiscalYear - 1;
  const fyStartMonth = yearEndMonth === 12 ? 0 : yearEndMonth;
  const q = p.fiscalQuarter ?? 4;
  return {
    startDate: iso(fyStartYear, fyStartMonth + (p.kind === "quarter" ? (q - 1) * 3 : 0), 1),
    endDate: iso(fyStartYear, fyStartMonth + (p.kind === "annual" ? 12 : q * 3), 0),
  };
}
export function parseFinancialDataset(raw: string): Calculation<FinancialDataset> {
  if (raw.length > MAX_DATASET_LENGTH) return failure("invalid", "JSON tối đa 1.000.000 ký tự.");
  let input: unknown;
  try { input = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { return failure("invalid", "JSON không hợp lệ. Giữ số thiếu là null, không để NaN hoặc dấu phân cách hàng nghìn."); }
  const parsed = financialDatasetSchema.safeParse(input);
  if (!parsed.success) return failure("invalid", ...parsed.error.issues.slice(0, 10).map(i => `${i.path.join(".")}: ${i.message}`));
  const d: FinancialDataset = parsed.data;
  const issues: string[] = [];
  const sourceIds = new Set(d.sources.map(s => s.id));
  if (sourceIds.size !== d.sources.length) issues.push("ID nguồn bị lặp.");
  if (new Set(d.reports.map(r => r.id)).size !== d.reports.length) issues.push("ID kỳ báo cáo bị lặp.");
  const periodKeys = d.reports.map(r => `${r.kind}|${r.startDate}|${r.endDate}|${r.scope}|${r.restatement?.revision ?? "original"}`);
  if (new Set(periodKeys).size !== periodKeys.length) issues.push("Trùng kỳ/phạm vi: chỉ nhập một phiên bản, mô tả bản điều chỉnh trong basis.");
  function checkFact(f: Fact, key: string) {
    if (!sourceIds.has(f.sourceId)) issues.push(`${key}: nguồn ${f.sourceId} không tồn tại.`);
    try { factValue(f); } catch { issues.push(`${key}: giá trị vượt phạm vi sau chuẩn hóa.`); }
    if (["price", "dilutedEps"].includes(key.split(".").at(-1)!) && f.unit !== "unit") issues.push(`${key}: giá/EPS phải dùng đơn vị tiền/cổ phiếu (unit).`);
  }
  for (const p of d.reports) {
    if (p.openingReportId && !d.reports.some(r => r.id === p.openingReportId && r.id !== p.id)) issues.push(`${p.id}: openingReportId không tồn tại hoặc trỏ vào chính kỳ này.`);
    if ((p.kind === "annual") !== (p.fiscalQuarter === null)) issues.push(`${p.id}: năm cần fiscalQuarter=null; quý/YTD cần quý 1–4.`);
    const dates = expectedPeriodDates(p, d.fiscalYearEndMonth);
    if (p.startDate !== dates.startDate || p.endDate !== dates.endDate) issues.push(`${p.id}: kỳ/ngày không khớp lịch năm tài chính (${dates.startDate} → ${dates.endDate}).`);
    if (p.publishedAt < p.endDate) issues.push(`${p.id}: công bố không được trước cuối kỳ.`);
    const fields = "fields" in p ? p.fields : "bank" in p ? p.bank : "securities" in p ? p.securities : p.insurance;
    for (const [key, value] of Object.entries(fields)) checkFact(value, `${p.id}.${key}`);
    if ("fields" in p) for (const key of ["cash", "receivables", "inventory", "currentAssets", "totalAssets", "currentLiabilities", "shortTermDebt", "longTermDebt", "totalLiabilities", "capex", "depreciation", "minorityInterest", "preferredEquity", "nonOperatingAssets", "otherClaims"] as const) {
      if (p.fields[key].value !== null && p.fields[key].value! < 0) issues.push(`${p.id}.${key}: quy ước đầu vào cần số không âm.`);
    }
  }
  if (d.market) {
    checkFact(d.market.price, "market.price"); checkFact(d.market.sharesOutstanding, "market.sharesOutstanding");
    for (const key of ["price", "sharesOutstanding"] as const) if (d.market[key].value !== null && d.market[key].value! <= 0) issues.push(`market.${key}: cần số dương hoặc null.`);
  }
  if (d.corporateActions) {
    const actions = d.corporateActions;
    if (!sourceIds.has(actions.sourceId) || actions.reviewedFrom > actions.reviewedThrough || actions.events.some(e => e.date < actions.reviewedFrom || e.date > actions.reviewedThrough)) issues.push("Corporate actions: nguồn hoặc phạm vi rà soát không hợp lệ.");
  }
  return issues.length ? failure("invalid", ...issues.slice(0, 15)) : success(d);
}

export function convertYtdToQuarter(current: CorporateReport, prior: CorporateReport | null): Calculation<NormalizedReport> {
  if (current.kind !== "ytd" || !current.fiscalQuarter) return failure("incompatible", "Cần báo cáo YTD với quý rõ ràng.");
  const startMonth = Number(current.startDate.slice(5, 7));
  const yearEndMonth = startMonth === 1 ? 12 : startMonth - 1;
  for (const period of [current, ...(prior ? [prior] : [])]) {
    const expected = expectedPeriodDates(period, yearEndMonth);
    if (!isDate(period.startDate) || !isDate(period.endDate) || period.startDate !== expected.startDate || period.endDate !== expected.endDate) return failure("incompatible", "YTD không khớp lịch tài chính và kỳ quý liên tục.");
  }
  if (current.fiscalQuarter === 1) return success({ ...normalizeReport(current), kind: "quarter" }, ["Quý 1 bằng YTD quý 1; số dư vẫn tại cuối kỳ."]);
  if (!prior || prior.kind !== "ytd" || prior.fiscalYear !== current.fiscalYear || prior.fiscalQuarter !== current.fiscalQuarter - 1 || prior.startDate !== current.startDate || prior.endDate >= current.endDate || prior.scope !== current.scope || prior.basis !== current.basis)
    return failure("incompatible", "Cần YTD liền trước, cùng năm, đầu kỳ, phạm vi và cơ sở điều chỉnh; không thay phần thiếu bằng 0.");
  const a = normalizeReport(current), b = normalizeReport(prior);
  const values = { ...a.values };
  for (const key of CORPORATE_FIELDS) {
    if ((BALANCE_FIELDS as readonly string[]).includes(key)) continue;
    values[key] = key === "dilutedEps" || a.values[key] === null || b.values[key] === null ? null : a.values[key]! - b.values[key]!;
    if (values[key] !== null && (!Number.isFinite(values[key]) || Math.abs(values[key]!) > Number.MAX_SAFE_INTEGER)) return failure("invalid", "Giá trị hiệu YTD vượt phạm vi an toàn.");
  }
  const nextStart = new Date(prior.endDate + "T00:00:00Z"); nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  const inputs = [current, prior].flatMap(p => CORPORATE_FIELDS.map(key => ({ key, periodId: p.id, value: factValue(p.fields[key]), sourceId: p.fields[key].sourceId, locator: p.fields[key].locator })));
  return success({ ...a, id: `${current.id}_derivedQ`, kind: "quarter", startDate: nextStart.toISOString().slice(0, 10), values, derivation: { method: "ytd_difference", inputs } }, ["Dòng tiền/lợi nhuận = YTD hiện tại − YTD trước. Số dư giữ cuối kỳ. EPS quý không suy ra bằng phép trừ; cần EPS quý công bố riêng.", `Đầu vào: ${current.id} và ${prior.id}; kỳ điều chỉnh phải được người dùng đối chiếu.`]);
}

export function createDatasetTemplate(symbol: string, industry: Industry, filledMock = false): FinancialDataset {
  const src = filledMock ? "MOCK" : "SOURCE1";
  const f = (value: number | null, unit: Unit = "million"): Fact => ({ value, unit, sourceId: src, locator: filledMock ? "Số liệu luyện tập giả lập, không phải báo cáo doanh nghiệp" : "Ghi trang/bảng của tài liệu gốc" });
  const base = { version: "2.0" as const, symbol, name: `${symbol} · ${filledMock ? "BỘ DỮ LIỆU MOCK" : "Hồ sơ người dùng nhập"}`, currency: "VND" as const, fiscalYearEndMonth: 12, sources: [{ id: src, title: filledMock ? "MOCK · Bộ số liệu luyện tập Engine" : "Điền tên tài liệu nguồn", url: "", accessedAt: "2026-10-10", provenance: filledMock ? "mock" as const : "user_supplied" as const }], market: { asOf: "2026-04-01", price: f(filledMock ? 12000 : null, "unit"), sharesOutstanding: f(filledMock ? 0.1 : null, "million"), basis: "Cùng cơ sở cổ phiếu; chưa có chia tách" } };
  const metadata = (year: number): PeriodMetadata => ({ id: `FY${year}`, kind: "annual", fiscalYear: year, fiscalQuarter: null, startDate: `${year}-01-01`, endDate: `${year}-12-31`, scope: "consolidated", audited: filledMock ? "unaudited" : "unknown", publishedAt: `${year + 1}-03-31`, basis: "Cùng cơ sở cổ phiếu; chưa có chia tách" });
  if (industry === "bank") return { ...base, industry, reports: [{ ...metadata(2025), bank: { netInterestIncome: f(null), grossLoans: f(null), nonPerformingLoans: f(null), regulatoryCapital: f(null), riskWeightedAssets: f(null) } }] };
  if (industry === "securities") return { ...base, industry, reports: [{ ...metadata(2025), securities: { brokerageRevenue: f(null), tradingAssets: f(null), clientMoney: f(null) } }] };
  if (industry === "insurance") return { ...base, industry, reports: [{ ...metadata(2025), insurance: { insuranceRevenue: f(null), claimsExpense: f(null), insuranceLiabilities: f(null) } }] };
  const reports = [2024, 2025].map((year, index) => {
    // Explicit independent educational fixture, never an adapter for Phase 1 prices/ratios.
    const values: Record<CorporateField, number> = { revenue: index ? 1200 : 1000, costOfRevenue: index ? 720 : 600, grossProfit: index ? 480 : 400, operatingExpenses: index ? 240 : 200, ebit: index ? 240 : 200, interestExpense: 20, pretaxIncome: index ? 220 : 180, incomeTax: index ? 44 : 36, netIncome: index ? 176 : 144, netIncomeToCommon: index ? 176 : 144, dilutedEps: index ? 1760 : 1440, depreciation: index ? 60 : 50, cash: index ? 150 : 100, receivables: index ? 180 : 150, inventory: index ? 240 : 200, currentAssets: index ? 600 : 500, totalAssets: index ? 1500 : 1200, currentLiabilities: index ? 300 : 250, shortTermDebt: 100, longTermDebt: 200, totalLiabilities: index ? 500 : 450, shareholdersEquity: index ? 1000 : 750, minorityInterest: 0, preferredEquity: 0, nonOperatingAssets: 0, otherClaims: 0, operatingWorkingCapital: index ? 120 : 100, cfo: index ? 220 : 180, capex: index ? 80 : 70, cfi: index ? -80 : -70, cff: index ? -90 : -50 };
    return { ...metadata(year), fields: Object.fromEntries(CORPORATE_FIELDS.map(key => [key, f(filledMock ? values[key] : null, key === "dilutedEps" ? "unit" : "million")])) as Record<CorporateField, Fact> };
  });
  return { ...base, industry, analysisAsOf: "2026-04-01", market: { ...base.market, sharesAsOf: "2025-12-31" }, corporateActions: { reviewedFrom: "2025-12-31", reviewedThrough: "2026-04-01", sourceId: src, events: [] }, reports } satisfies CorporateDataset;
}
