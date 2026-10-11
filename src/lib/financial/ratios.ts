import { factValue, normalizeReport, UNIT_SCALE } from "./schema";
import { failure, finiteResult, success } from "./result";
import { compatibleAnnualHistory, comparablePeriod, resolveOpening, validPeriod } from "./periods";
import { marketDateGuard } from "./dates";
import type { Calculation, CorporateDataset, CorporateField, CorporateReport, FinancialDataset, InputEvidence, NormalizedReport, RatioResult } from "./types";
type N = number | null;
const valid = (...values: N[]): Calculation<number[]> => values.some(v => v === null) ? failure("missing_data", "Thiếu đầu vào; không thay null bằng 0.") : values.some(v => !Number.isFinite(v) || Math.abs(v!) > Number.MAX_SAFE_INTEGER) ? failure("invalid", "Đầu vào không hữu hạn hoặc vượt phạm vi an toàn.") : success(values as number[]);
function divide(n: N, d: N): Calculation<number> {
  const input = valid(n, d); if (!input.ok) return input;
  return d! <= 0 ? failure("not_meaningful", "Mẫu số phải dương; tỷ số không có ý nghĩa với mẫu số bằng 0 hoặc âm.") : finiteResult(n! / d!);
}
function averageRatio(n: N, opening: N, closing: N) {
  const input = valid(n, opening, closing); if (!input.ok) return input;
  if (opening! <= 0 || closing! <= 0) return failure("not_meaningful", "Số dư đầu và cuối kỳ phải dương để dùng số bình quân.");
  return divide(n, (opening! + closing!) / 2);
}
const sum = (...values: N[]): N => values.some(v => v === null) ? null : values.reduce<number>((a, b) => a + b!, 0);
export const grossMargin = (grossProfit: N, revenue: N) => divide(grossProfit, revenue);
export const operatingMargin = (ebit: N, revenue: N) => divide(ebit, revenue);
export const netProfitMargin = (netIncome: N, revenue: N) => divide(netIncome, revenue);
export const roe = (commonIncome: N, openingEquity: N, closingEquity: N) => averageRatio(commonIncome, openingEquity, closingEquity);
export const roa = (netIncome: N, openingAssets: N, closingAssets: N) => averageRatio(netIncome, openingAssets, closingAssets);
export function roic(ebit: N, taxRate: N, openingCapital: N, closingCapital: N): Calculation<number> {
  const input = valid(ebit, taxRate, openingCapital, closingCapital); if (!input.ok) return input;
  if (taxRate! < 0 || taxRate! > 1) return failure("not_meaningful", "Thuế suất NOPAT phải trong [0,1].");
  return averageRatio(ebit! * (1 - taxRate!), openingCapital, closingCapital);
}
export const currentRatio = (assets: N, liabilities: N) => divide(assets, liabilities);
/** Conservative quick ratio: cash + trade receivables; excludes unavailable marketable securities. */
export const quickRatio = (cash: N, receivables: N, liabilities: N) => divide(sum(cash, receivables), liabilities);
export const cashRatio = (cash: N, liabilities: N) => divide(cash, liabilities);
export const debtToEquity = (shortDebt: N, longDebt: N, equity: N) => divide(sum(shortDebt, longDebt), equity);
export function netDebt(shortDebt: N, longDebt: N, cash: N): Calculation<number> {
  const input = valid(shortDebt, longDebt, cash); return input.ok ? finiteResult(shortDebt! + longDebt! - cash!) : input;
}
export const interestCoverage = (ebit: N, interest: N) => divide(ebit, interest);
export const assetTurnover = (revenue: N, opening: N, closing: N) => averageRatio(revenue, opening, closing);
export const inventoryTurnover = (cost: N, opening: N, closing: N) => averageRatio(cost, opening, closing);
export function receivableDays(opening: N, closing: N, revenue: N, days: N): Calculation<number> {
  const input = valid(opening, closing, revenue, days); if (!input.ok) return input;
  if (opening! < 0 || closing! < 0 || days! <= 0) return failure("not_meaningful", "Phải thu không âm và số ngày kỳ phải dương.");
  return divide((opening! + closing!) / 2 * days!, revenue);
}
export const operatingCashFlowToNetIncome = (cfo: N, income: N) => divide(cfo, income);
export function freeCashFlow(cfo: N, capex: N): Calculation<number> {
  const input = valid(cfo, capex); if (!input.ok) return input;
  return capex! < 0 ? failure("invalid", "CAPEX nhập theo chi đầu tư dương.") : finiteResult(cfo! - capex!);
}
export function fcfMargin(cfo: N, capex: N, revenue: N): Calculation<number> { const fcf = freeCashFlow(cfo, capex); return fcf.ok ? divide(fcf.value, revenue) : fcf; }
export const cashConversion = (cfo: N, ebit: N, da: N) => divide(cfo, sum(ebit, da));
export function growth(current: N, previous: N): Calculation<number> { const input = valid(current, previous); return input.ok ? divide(current! - previous!, previous) : input; }
export function cagr(start: N, end: N, years: N): Calculation<number> {
  const input = valid(start, end, years); if (!input.ok) return input;
  if (start! <= 0 || end! < 0 || years! <= 0) return failure("not_meaningful", "CAGR cần kỳ gốc dương, kỳ cuối không âm, khoảng năm dương.");
  return finiteResult((end! / start!) ** (1 / years!) - 1);
}
function positiveMultiple(numerator: N, denominator: N): Calculation<number> {
  const checked = valid(numerator, denominator); if (!checked.ok) return checked;
  return numerator! <= 0 ? failure("not_meaningful", "Giá hoặc EV không dương: không diễn giải hệ số định giá như hợp lệ.") : divide(numerator, denominator);
}
export const pe = (price: N, eps: N) => positiveMultiple(price, eps);
export function pb(price: N, commonEquity: N, shares: N): Calculation<number> { const bvps = divide(commonEquity, shares); return bvps.ok ? positiveMultiple(price, bvps.value) : bvps; }
export const evEbitda = (ev: N, ebit: N, da: N) => positiveMultiple(ev, sum(ebit, da));
export function fcfYield(cfo: N, capex: N, marketCap: N): Calculation<number> { const fcf = freeCashFlow(cfo, capex); return fcf.ok ? divide(fcf.value, marketCap) : fcf; }

export function accountingIssues(report: CorporateReport): string[] {
  const v = normalizeReport(report).values, issues: string[] = [];
  const inconsistent = (keys: CorporateField[], expected: N, actual: N) => {
    if (expected === null || actual === null || keys.some(k => v[k] === null)) return false;
    const rounding = keys.reduce((total, key) => total + UNIT_SCALE[report.fields[key].unit] / 2, 0);
    return Math.abs(expected - actual) > Math.max(rounding, Math.max(Math.abs(expected), Math.abs(actual)) * 1e-9);
  };
  if (inconsistent(["revenue", "costOfRevenue", "grossProfit"], v.revenue === null || v.costOfRevenue === null ? null : v.revenue - v.costOfRevenue, v.grossProfit)) issues.push(`${report.id}: lợi nhuận gộp không khớp doanh thu − giá vốn.`);
  if (inconsistent(["pretaxIncome", "incomeTax", "netIncome"], v.pretaxIncome === null || v.incomeTax === null ? null : v.pretaxIncome - v.incomeTax, v.netIncome)) issues.push(`${report.id}: lợi nhuận sau thuế không khớp trước thuế − thuế.`);
  const balance = sum(v.totalLiabilities, v.shareholdersEquity, v.minorityInterest, v.preferredEquity);
  if (inconsistent(["totalAssets", "totalLiabilities", "shareholdersEquity", "minorityInterest", "preferredEquity"], balance, v.totalAssets)) issues.push(`${report.id}: tổng tài sản không khớp nợ + vốn thường + ưu đãi + NCI.`);
  if (v.currentAssets !== null && v.totalAssets !== null && v.currentAssets > v.totalAssets) issues.push(`${report.id}: tài sản ngắn hạn lớn hơn tổng tài sản.`);
  if (v.currentLiabilities !== null && v.totalLiabilities !== null && v.currentLiabilities > v.totalLiabilities) issues.push(`${report.id}: nợ ngắn hạn lớn hơn tổng nợ.`);
  return issues;
}
export function getDatasetWarnings(data: FinancialDataset): string[] {
  const messages = [data.sources.some(s => s.provenance === "mock") ? "MOCK · Bộ dữ liệu chứa số liệu luyện tập, kết quả không dùng cho cổ phiếu thực." : "Dữ liệu người dùng cung cấp chưa được hệ thống đối chiếu nguồn; tính đúng công thức không xác minh đầu vào."];
  if (data.industry !== "corporate") return [...messages, "Schema định chế tài chính mới là khung riêng. Khóa tỷ số doanh nghiệp thông thường và định giá cho đến khi có mô hình chuyên ngành."];
  return [...messages, ...data.reports.flatMap(accountingIssues), "Số dư bình quân cần kỳ kết thúc ngay trước đầu kỳ và cùng phạm vi/basis. Tỷ số theo đúng độ dài kỳ, không tự annualize."];
}
export function getHistoricalRows(data: FinancialDataset, reportId?: string) {
  if (data.industry !== "corporate") return [];
  // Annual trends only: never join YTD and standalone quarters as though comparable.
  return compatibleAnnualHistory(data, data.reports.find(p => p.id === reportId)).map(p => { const v = normalizeReport(p).values; return { period: p.id, revenue: v.revenue, netIncome: v.netIncome, cfo: v.cfo }; });
}
export function openingReport(data: CorporateDataset, current: CorporateReport): CorporateReport | undefined {
  const result = resolveOpening(data, current); return result.ok ? result.value : undefined;
}
export function marketGuard(data: CorporateDataset, period: CorporateReport): Calculation<true> {
  if (period.kind !== "annual") return failure("incompatible", "Chỉ tính chỉ số thị trường từ năm đầy đủ hoặc TTM đã dựng; không dùng trực tiếp quý/YTD.");
  if (!data.market) return failure("missing_data", "Thiếu giá tham chiếu, số cổ phiếu và ngày chốt.");
  if (data.market.asOf < period.publishedAt || data.market.basis !== period.basis) return failure("incompatible", "Ngày giá phải từ ngày công bố trở đi và cùng cơ sở cổ phiếu/basis.");
  return marketDateGuard(data, period);
}
type Values = NormalizedReport["values"];
type Context = { v: Values; o: Values | null; p: Values | null; first: Values | null; years: number; days: number; price: N; shares: N };
type Definition = Pick<RatioResult, "id" | "label" | "group" | "unit" | "formula" | "meaning" | "limitations"> & { fields: CorporateField[]; opening?: CorporateField[]; previous?: CorporateField[]; market?: boolean; calc: (c: Context) => Calculation<number> };
const equity = (v: Values | null) => v ? sum(v.shareholdersEquity, v.minorityInterest, v.preferredEquity) : null;
const invested = (v: Values | null): N => { if (!v) return null; const e = equity(v), debt = sum(v.shortTermDebt, v.longTermDebt); return e === null || debt === null || v.cash === null ? null : e + debt - v.cash; };
const capitalFields: CorporateField[] = ["shareholdersEquity", "minorityInterest", "preferredEquity", "shortTermDebt", "longTermDebt", "cash"];
const def = (id: string, label: string, group: string, unit: Definition["unit"], formula: string, fields: CorporateField[], calc: Definition["calc"], extra: Partial<Definition> = {}): Definition => ({ id, label, group, unit, formula, fields, calc, meaning: `Đo lường ${label.toLowerCase()} của kỳ được chọn.`, limitations: "Không suy ra khuyến nghị từ một tỷ số. Phải đối chiếu ngành, kỳ và nguồn dữ liệu.", ...extra });
export const RATIO_DEFINITIONS: Definition[] = [
  def("grossMargin", "Biên lợi nhuận gộp", "Sinh lời", "percent", "Lợi nhuận gộp / Doanh thu", ["grossProfit", "revenue"], c => grossMargin(c.v.grossProfit, c.v.revenue)),
  def("operatingMargin", "Biên EBIT", "Sinh lời", "percent", "EBIT / Doanh thu", ["ebit", "revenue"], c => operatingMargin(c.v.ebit, c.v.revenue)),
  def("netProfitMargin", "Biên lợi nhuận ròng", "Sinh lời", "percent", "LN sau thuế tổng / Doanh thu", ["netIncome", "revenue"], c => netProfitMargin(c.v.netIncome, c.v.revenue)),
  def("roe", "ROE", "Sinh lời", "percent", "LN cổ đông thường / Vốn cổ đông thường bình quân đầu–cuối kỳ", ["netIncomeToCommon", "shareholdersEquity"], c => roe(c.v.netIncomeToCommon, c.o?.shareholdersEquity ?? null, c.v.shareholdersEquity), { opening: ["shareholdersEquity"] }),
  def("roa", "ROA", "Sinh lời", "percent", "LN sau thuế tổng / Tổng tài sản bình quân đầu–cuối kỳ", ["netIncome", "totalAssets"], c => roa(c.v.netIncome, c.o?.totalAssets ?? null, c.v.totalAssets), { opening: ["totalAssets"] }),
  def("roic", "ROIC (thuế hiệu dụng)", "Sinh lời", "percent", "EBIT × (1−Thuế/LNTT) / bình quân (vốn thường+NCI+ưu đãi+nợ vay−tiền)", ["ebit", "incomeTax", "pretaxIncome", ...capitalFields], c => { const tax = divide(c.v.incomeTax, c.v.pretaxIncome); return tax.ok ? roic(c.v.ebit, tax.value, invested(c.o), invested(c.v)) : tax; }, { opening: capitalFields, limitations: "Dùng thuế hiệu dụng lịch sử; chưa chuẩn hóa thuế, tiền dư thừa và tài sản ngoài hoạt động. Không dùng khi LNTT không dương." }),
  def("currentRatio", "Thanh toán hiện hành", "Thanh khoản", "times", "Tài sản ngắn hạn / Nợ ngắn hạn", ["currentAssets", "currentLiabilities"], c => currentRatio(c.v.currentAssets, c.v.currentLiabilities)),
  def("quickRatio", "Thanh toán nhanh (thận trọng)", "Thanh khoản", "times", "(Tiền + Phải thu thương mại) / Nợ ngắn hạn", ["cash", "receivables", "currentLiabilities"], c => quickRatio(c.v.cash, c.v.receivables, c.v.currentLiabilities), { limitations: "Không gồm chứng khoán ngắn hạn vì schema chưa tách khoản này; không dùng công thức CA−tồn kho khi có trả trước." }),
  def("cashRatio", "Thanh toán bằng tiền", "Thanh khoản", "times", "Tiền / Nợ ngắn hạn", ["cash", "currentLiabilities"], c => cashRatio(c.v.cash, c.v.currentLiabilities)),
  def("debtToEquity", "Nợ vay / Vốn chủ", "Đòn bẩy", "times", "(Nợ vay ngắn+dài hạn) / (vốn thường+NCI+ưu đãi)", ["shortTermDebt", "longTermDebt", "shareholdersEquity", "minorityInterest", "preferredEquity"], c => debtToEquity(c.v.shortTermDebt, c.v.longTermDebt, equity(c.v))),
  def("netDebt", "Nợ vay ròng", "Đòn bẩy", "money", "Nợ vay ngắn+dài hạn−Tiền", ["shortTermDebt", "longTermDebt", "cash"], c => netDebt(c.v.shortTermDebt, c.v.longTermDebt, c.v.cash), { limitations: "Âm thể hiện tiền ròng theo đầu vào; chưa phân biệt tiền bị hạn chế sử dụng." }),
  def("interestCoverage", "Khả năng trả lãi", "Đòn bẩy", "times", "EBIT / Chi phí lãi vay", ["ebit", "interestExpense"], c => interestCoverage(c.v.ebit, c.v.interestExpense)),
  def("assetTurnover", "Vòng quay tài sản", "Hiệu quả", "times", "Doanh thu / Tài sản bình quân", ["revenue", "totalAssets"], c => assetTurnover(c.v.revenue, c.o?.totalAssets ?? null, c.v.totalAssets), { opening: ["totalAssets"] }),
  def("inventoryTurnover", "Vòng quay tồn kho", "Hiệu quả", "times", "Giá vốn / Tồn kho bình quân", ["costOfRevenue", "inventory"], c => inventoryTurnover(c.v.costOfRevenue, c.o?.inventory ?? null, c.v.inventory), { opening: ["inventory"] }),
  def("receivableDays", "Số ngày phải thu", "Hiệu quả", "days", "Phải thu bình quân / Doanh thu × số ngày thực tế kỳ", ["receivables", "revenue"], c => receivableDays(c.o?.receivables ?? null, c.v.receivables, c.v.revenue, c.days), { opening: ["receivables"], limitations: "Dùng doanh thu tổng làm proxy doanh thu bán chịu; không mặc định mọi kỳ có 365 ngày." }),
  def("cfoNetIncome", "CFO / Lợi nhuận", "Dòng tiền", "times", "CFO / LN sau thuế tổng", ["cfo", "netIncome"], c => operatingCashFlowToNetIncome(c.v.cfo, c.v.netIncome)),
  def("freeCashFlow", "FCF đơn giản", "Dòng tiền", "money", "CFO − CAPEX (chi dương)", ["cfo", "capex"], c => freeCashFlow(c.v.cfo, c.v.capex), { limitations: "Không phải FCFF hoặc FCFE; CFO chịu ảnh hưởng cách phân loại lãi vay và dòng tiền." }),
  def("fcfMargin", "Biên FCF", "Dòng tiền", "percent", "(CFO−CAPEX) / Doanh thu", ["cfo", "capex", "revenue"], c => fcfMargin(c.v.cfo, c.v.capex, c.v.revenue)),
  def("cashConversion", "Chuyển đổi tiền / EBITDA", "Dòng tiền", "times", "CFO / (EBIT+D&A)", ["cfo", "ebit", "depreciation"], c => cashConversion(c.v.cfo, c.v.ebit, c.v.depreciation), { limitations: "Định nghĩa sử dụng: CFO/EBITDA. Đây không phải chu kỳ chuyển đổi tiền mặt CCC; EBITDA không thay thế CFO." }),
  ...([ ["revenueGrowth", "Tăng trưởng doanh thu", "revenue"], ["earningsGrowth", "Tăng trưởng LN cổ đông thường", "netIncomeToCommon"], ["epsGrowth", "Tăng trưởng EPS pha loãng", "dilutedEps"] ] as const).map(([id, label, key]) => def(id, label, "Tăng trưởng", "percent", "(Kỳ này − Cùng kỳ trước) / Cùng kỳ trước", [key], c => growth(c.v[key], c.p?.[key] ?? null), { previous: [key], limitations: "Cùng loại/độ dài kỳ, phạm vi và basis. Mẫu số không dương: not meaningful. EPS cần cơ sở pha loãng/chia tách tương thích." })),
  def("revenueCagr", "CAGR doanh thu", "Tăng trưởng", "percent", "(Doanh thu cuối / đầu)^(1/số năm)−1", ["revenue"], c => cagr(c.first?.revenue ?? null, c.v.revenue, c.years), { limitations: "Chỉ dùng báo cáo năm cùng scope/basis; không mô tả biến động giữa các năm." }),
  def("pe", "P/E pha loãng", "Thị trường", "times", "Giá tham chiếu / EPS pha loãng năm", ["dilutedEps"], c => pe(c.price, c.v.dilutedEps), { market: true }),
  def("pb", "P/B", "Thị trường", "times", "Giá / (Vốn cổ đông thường / cổ phiếu lưu hành)", ["shareholdersEquity"], c => pb(c.price, c.v.shareholdersEquity, c.shares), { market: true }),
  def("evEbitda", "EV / EBITDA", "Thị trường", "times", "(Vốn hóa+nợ+NCI+ưu đãi+claims−tiền−TS ngoài HĐ) / (EBIT+D&A)", ["ebit", "depreciation", "shortTermDebt", "longTermDebt", "minorityInterest", "preferredEquity", "otherClaims", "cash", "nonOperatingAssets"], c => {
    const v = c.v, parts = valid(c.price, c.shares, v.shortTermDebt, v.longTermDebt, v.minorityInterest, v.preferredEquity, v.otherClaims, v.cash, v.nonOperatingAssets);
    return parts.ok ? evEbitda(c.price! * c.shares! + v.shortTermDebt! + v.longTermDebt! + v.minorityInterest! + v.preferredEquity! + v.otherClaims! - v.cash! - v.nonOperatingAssets!, v.ebit, v.depreciation) : parts;
  }, { market: true, limitations: "Enterprise value hoạt động; tiền/TS ngoài HĐ không được trùng, claims phải đầy đủ. Không dùng cho định chế tài chính." }),
  def("fcfYield", "Lợi suất FCF đơn giản", "Thị trường", "percent", "(CFO−CAPEX) / (Giá × Cổ phiếu lưu hành)", ["cfo", "capex"], c => fcfYield(c.v.cfo, c.v.capex, c.price === null || c.shares === null ? null : c.price * c.shares), { market: true, limitations: "FCF đơn giản không phải FCFE. Lợi suất không phải suất sinh lợi được đảm bảo." }),
];

export function analyzeRatios(data: FinancialDataset, reportId: string): RatioResult[] {
  const report = data.industry === "corporate" ? data.reports.find(r => r.id === reportId) : undefined;
  const current = report ? normalizeReport(report) : null;
  const opening = data.industry === "corporate" && report ? openingReport(data, report) : undefined;
  const previous = data.industry === "corporate" && report ? comparablePeriod(data, report) : undefined;
  const first = data.industry === "corporate" && report?.kind === "annual" && !report.derived ? compatibleAnnualHistory(data, report).find(p => p.fiscalYear < report.fiscalYear) : undefined;
  const evidence = (p: CorporateReport | undefined, keys: CorporateField[]): InputEvidence[] => p?.derived ? p.derived.inputs.filter(i => keys.includes(i.key as CorporateField)) : p ? keys.map(key => ({ key, value: factValue(p.fields[key]), sourceId: p.fields[key].sourceId, locator: p.fields[key].locator, periodId: p.id })) : [];
  return RATIO_DEFINITIONS.map(definition => {
    const inputs = [...evidence(report, definition.fields), ...evidence(opening, definition.opening ?? []), ...evidence(previous, definition.previous ?? []), ...(definition.id === "revenueCagr" ? evidence(first, ["revenue"]) : [])];
    if (definition.market && data.market) for (const key of ["price", "sharesOutstanding"] as const) inputs.push({ key, value: factValue(data.market[key]), sourceId: data.market[key].sourceId, locator: data.market[key].locator, periodId: `market@${data.market.asOf}` });
    const sourceIds = [...new Set(inputs.map(i => i.sourceId))];
    let result: Calculation<number>;
    if (data.industry !== "corporate") result = failure("unsupported", "Không áp dụng Ratio Engine doanh nghiệp phi tài chính cho ngân hàng/chứng khoán/bảo hiểm.");
    else if (!report || !current) result = failure("missing_data", "Chưa chọn kỳ báo cáo.");
    else if (!validPeriod(data, report)) result = failure("incompatible", "Kỳ báo cáo không khớp lịch tài chính.");
    else if (accountingIssues(report).length) result = failure("incompatible", ...accountingIssues(report));
    else if (definition.opening && !opening) result = resolveOpening(data, report) as Calculation<never>;
    else if (definition.opening && opening && accountingIssues(opening).length) result = failure("incompatible", "Số dư đầu kỳ có mâu thuẫn kế toán.");
    else if (definition.previous && (!previous || accountingIssues(previous).length)) result = failure("incompatible", "Thiếu hoặc mâu thuẫn kỳ so sánh cùng kỳ/scope/basis.");
    else if (definition.id === "revenueCagr" && first && accountingIssues(first).length) result = failure("incompatible", "Báo cáo năm đầu CAGR có số liệu mâu thuẫn.");
    else if (definition.market && !marketGuard(data, report).ok) result = marketGuard(data, report) as Calculation<never>;
    else result = definition.calc({ v: current.values, o: opening ? normalizeReport(opening).values : null, p: previous ? normalizeReport(previous).values : null, first: first ? normalizeReport(first).values : null, years: first ? report.fiscalYear - first.fiscalYear : 0, days: (Date.parse(report.endDate) - Date.parse(report.startDate)) / 86400000 + 1, price: data.market ? factValue(data.market.price) : null, shares: data.market ? factValue(data.market.sharesOutstanding) : null });
    const { id, label, group, unit, formula, meaning, limitations } = definition;
    return { id, label, group, unit, formula, meaning, limitations, result, inputs, provenance: { kind: "calculated", containsMock: data.sources.some(s => sourceIds.includes(s.id) && s.provenance === "mock"), sourceIds } };
  });
}
