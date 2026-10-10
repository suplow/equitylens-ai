import { z } from "zod";
import { factValue, normalizeReport } from "./schema";
import { accountingIssues, marketGuard, openingReport } from "./ratios";
import { failure, finiteResult, success } from "./result";
import type { Calculation, CorporateDataset, CorporateField, CorporateReport, FinancialDataset } from "./types";

type N = number | null;
export interface EquityBridge { cash: N; debt: N; nonOperatingAssets: N; minorityInterest: N; preferredEquity: N; otherClaims: N; sharesOutstanding: N }
export interface ScenarioAssumptions {
  name: "Bear" | "Base" | "Bull"; years: number; growth: N; ebitMargin: N; taxRate: N; depreciationRate: N; capexRate: N; workingCapitalRate: N; wacc: N; terminalGrowth: N; peMultiple: N; pbMultiple: N; evEbitdaMultiple: N;
}
export interface Projection { year: number; revenue: number; ebit: number; nopat: number; depreciation: number; capex: number; workingCapital: number; changeWorkingCapital: number; fcff: number; discountFactor: number; presentValue: number }
export interface RelativeOutput { enterpriseValue: number | null; equityValue: number; intrinsicValuePerShare: number; upside: number | null; marginOfSafety: number | null }
export interface DcfValues extends RelativeOutput { enterpriseValue: number; pvForecast: number; terminalValue: number; pvTerminal: number; terminalContribution: number }
export interface DcfOutput extends DcfValues {
  projections: Projection[]; bridge: EquityBridge; historicalFcff: Calculation<number>;
  assumptions: ScenarioAssumptions;
  provenance: { kind: "calculated"; containsMock: boolean; sourceIds: string[]; reportId: string; valuationAsOf: string; marketAsOf: string; currency: string };
}
const input = (...values: N[]): Calculation<number[]> => values.some(v => v === null) ? failure("missing_data", "Thiếu đầu vào/giả định. Khoản bằng 0 phải được nhập rõ, không tự thay null.") : values.some(v => !Number.isFinite(v) || Math.abs(v!) > Number.MAX_SAFE_INTEGER) ? failure("invalid", "Số đầu vào không hữu hạn hoặc vượt phạm vi an toàn.") : success(values as number[]);
const rate = z.number().finite().nullable();
const assumptionSchema = z.object({ name: z.enum(["Bear", "Base", "Bull"]), years: z.number().int().min(1).max(10), growth: rate, ebitMargin: rate, taxRate: rate, depreciationRate: rate, capexRate: rate, workingCapitalRate: rate, wacc: rate, terminalGrowth: rate, peMultiple: rate, pbMultiple: rate, evEbitdaMultiple: rate }).strict();
export function parseScenarios(raw: string): Calculation<ScenarioAssumptions[]> {
  if (raw.length > 20000) return failure("invalid", "Tệp giả định quá lớn.");
  let data: unknown; try { data = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { return failure("invalid", "JSON giả định không hợp lệ."); }
  const parsed = z.array(assumptionSchema).length(3).safeParse(data);
  if (!parsed.success) return failure("invalid", ...parsed.error.issues.slice(0, 5).map(i => `${i.path.join(".")}: ${i.message}`));
  if (new Set(parsed.data.map(s => s.name)).size !== 3) return failure("invalid", "Cần đúng Bear, Base, Bull, không lặp tên.");
  return success(parsed.data);
}
export function defaultScenarios(mock = false): ScenarioAssumptions[] {
  return (["Bear", "Base", "Bull"] as const).map((name, i) => ({ name, years: 5, growth: mock ? [.02, .05, .08][i] : null, ebitMargin: mock ? [.16, .2, .23][i] : null, taxRate: mock ? .2 : null, depreciationRate: mock ? .05 : null, capexRate: mock ? .07 : null, workingCapitalRate: mock ? .1 : null, wacc: mock ? [.14, .12, .1][i] : null, terminalGrowth: mock ? [.01, .02, .025][i] : null, peMultiple: null, pbMultiple: null, evEbitdaMultiple: null }));
}
export function calculateFcff(ebit: N, taxRate: N, depreciation: N, capex: N, changeWorkingCapital: N): Calculation<number> {
  const checked = input(ebit, taxRate, depreciation, capex, changeWorkingCapital); if (!checked.ok) return checked;
  if (taxRate! < 0 || taxRate! > 1 || depreciation! < 0 || capex! < 0) return failure("invalid", "Thuế suất trong [0,1]; D&A và CAPEX không âm.");
  if (ebit! < 0 && taxRate! > 0) return failure("not_meaningful", "Không giả định hoàn thuế ngay khi EBIT âm; cần mô hình lỗ chuyển kỳ hoặc thuế suất 0 được giải thích.");
  return finiteResult(ebit! * (1 - taxRate!) + depreciation! - capex! - changeWorkingCapital!);
}
export function calculateWacc(costOfEquity: N, costOfDebt: N, taxRate: N, equityWeight: N): Calculation<number> {
  const checked = input(costOfEquity, costOfDebt, taxRate, equityWeight); if (!checked.ok) return checked;
  if (costOfEquity! <= 0 || costOfDebt! < 0 || taxRate! < 0 || taxRate! > 1 || equityWeight! < 0 || equityWeight! > 1) return failure("invalid", "WACC cần chi phí vốn hợp lệ, thuế và tỷ trọng vốn chủ trong [0,1].");
  const value = costOfEquity! * equityWeight! + costOfDebt! * (1 - taxRate!) * (1 - equityWeight!);
  return value > 0 ? finiteResult(value) : failure("invalid", "WACC phải dương.");
}
export function discountFactor(wacc: N, year: N): Calculation<number> {
  const checked = input(wacc, year); if (!checked.ok) return checked;
  if (wacc! <= 0 || !Number.isInteger(year) || year! < 1 || year! > 100) return failure("invalid", "WACC phải dương, năm chiết khấu là số nguyên từ 1 đến 100.");
  return finiteResult(1 / ((1 + wacc!) ** year!));
}
export function terminalValue(lastFcff: N, wacc: N, terminalGrowth: N): Calculation<number> {
  const checked = input(lastFcff, wacc, terminalGrowth); if (!checked.ok) return checked;
  if (wacc! <= 0 || terminalGrowth! <= -1 || wacc! <= terminalGrowth!) return failure("invalid", "Gordon Growth cần WACC > terminal growth, WACC > 0 và g > −100%.");
  if (lastFcff! <= 0) return failure("not_meaningful", "Mô hình Gordon hiện chỉ dùng FCFF năm cuối dương; cần mô hình chuyển tiếp khi dòng tiền còn âm.");
  return finiteResult(lastFcff! * (1 + terminalGrowth!) / (wacc! - terminalGrowth!));
}
export function equityBridge(enterpriseValue: N, bridge: EquityBridge): Calculation<{ equityValue: number; intrinsicValuePerShare: number }> {
  const checked = input(enterpriseValue, ...Object.values(bridge)); if (!checked.ok) return checked;
  if (Object.values(bridge).some(v => v! < 0) || bridge.sharesOutstanding! <= 0) return failure("not_meaningful", "Các khoản cầu nối không âm và số cổ phiếu phải dương.");
  const equityValue = enterpriseValue! + bridge.cash! + bridge.nonOperatingAssets! - bridge.debt! - bridge.minorityInterest! - bridge.preferredEquity! - bridge.otherClaims!;
  if (!finiteResult(equityValue).ok) return failure("invalid", "Giá trị vốn chủ vượt phạm vi an toàn.");
  if (equityValue <= 0) return failure("not_meaningful", "Giá trị vốn chủ theo mô hình không dương; không hiển thị giá nội tại/MOS như một kết quả đầu tư hợp lệ.");
  const perShare = finiteResult(equityValue / bridge.sharesOutstanding!);
  return perShare.ok ? success({ equityValue, intrinsicValuePerShare: perShare.value }) : perShare;
}
function comparison(intrinsic: number, price: N) {
  return { upside: price !== null && price > 0 ? (intrinsic - price) / price : null, marginOfSafety: price !== null && price > 0 ? (intrinsic - price) / intrinsic : null };
}
export function discountCashFlows(flows: N[], wacc: N, terminalGrowth: N, bridge: EquityBridge, referencePrice: N): Calculation<DcfValues> {
  if (flows.length === 0 || flows.length > 10) return failure("invalid", "Dự phóng từ 1 đến 10 năm.");
  const checked = input(...flows, wacc, terminalGrowth); if (!checked.ok) return checked;
  if (referencePrice !== null && (!Number.isFinite(referencePrice) || referencePrice <= 0)) return failure("invalid", "Giá tham chiếu phải dương hoặc null.");
  const tv = terminalValue(flows.at(-1)!, wacc, terminalGrowth); if (!tv.ok) return tv;
  let pvForecast = 0;
  for (let i = 0; i < flows.length; i++) { const df = discountFactor(wacc, i + 1); if (!df.ok) return df; pvForecast += flows[i]! * df.value; }
  const lastDiscount = discountFactor(wacc, flows.length); if (!lastDiscount.ok) return lastDiscount;
  const pvTerminal = tv.value * lastDiscount.value, enterpriseValue = pvForecast + pvTerminal;
  if (![pvForecast, pvTerminal, enterpriseValue].every(v => finiteResult(v).ok)) return failure("invalid", "Giá trị chiết khấu vượt phạm vi số an toàn.");
  const equity = equityBridge(enterpriseValue, bridge); if (!equity.ok) return equity;
  if (enterpriseValue <= 0) return failure("not_meaningful", "Giá trị hoạt động không dương; mô hình không đủ điều kiện kết luận.");
  const terminalContribution = pvTerminal / enterpriseValue;
  const comparisons = comparison(equity.value.intrinsicValuePerShare, referencePrice);
  if (Object.values(comparisons).some(v => v !== null && !Number.isFinite(v))) return failure("invalid", "So sánh giá vượt phạm vi số.");
  return success({ ...equity.value, ...comparisons, enterpriseValue, pvForecast, terminalValue: tv.value, pvTerminal, terminalContribution }, ["DCF là kết quả có điều kiện theo giả định, không phải dự báo giá chắc chắn.", ...(terminalContribution > .75 ? ["Trên 75% EV đến từ terminal value; kết quả nhạy với WACC/g. Đây là ngưỡng cảnh báo mô hình, không là quy tắc đầu tư."] : [])]);
}
function datasetContext(data: FinancialDataset, reportId: string): Calculation<{ data: CorporateDataset; report: CorporateReport }> {
  if (data.industry !== "corporate") return failure("unsupported", "Khóa định giá ngân hàng/chứng khoán/bảo hiểm. Cần schema đầy đủ và mô hình P/B, residual income hoặc DDM chuyên ngành trước khi sử dụng.");
  const report = data.reports.find(p => p.id === reportId);
  if (!report) return failure("missing_data", "Chưa có kỳ tài chính được chọn.");
  const guard = marketGuard(data, report); if (!guard.ok) return guard;
  const issues = accountingIssues(report); if (issues.length) return failure("incompatible", ...issues);
  return success({ data, report });
}
function reportBridge(data: CorporateDataset, report: CorporateReport): EquityBridge {
  const v = normalizeReport(report).values;
  return { cash: v.cash, debt: v.shortTermDebt === null || v.longTermDebt === null ? null : v.shortTermDebt + v.longTermDebt, nonOperatingAssets: v.nonOperatingAssets, minorityInterest: v.minorityInterest, preferredEquity: v.preferredEquity, otherClaims: v.otherClaims, sharesOutstanding: data.market ? factValue(data.market.sharesOutstanding) : null };
}
export function historicalFcff(data: CorporateDataset, report: CorporateReport): Calculation<number> {
  const opening = openingReport(data, report), v = normalizeReport(report).values;
  if (!opening) return failure("missing_data", "Thiếu vốn lưu động hoạt động đầu kỳ cùng scope/basis để tính FCFF lịch sử.");
  if (accountingIssues(opening).length) return failure("incompatible", ...accountingIssues(opening));
  const before = normalizeReport(opening).values.operatingWorkingCapital;
  if (v.pretaxIncome === null || v.incomeTax === null || v.operatingWorkingCapital === null || before === null) return failure("missing_data", "Thiếu thuế hoặc vốn lưu động hoạt động.");
  if (v.pretaxIncome <= 0) return failure("not_meaningful", "Không suy thuế suất hiệu dụng khi LNTT không dương.");
  return calculateFcff(v.ebit, v.incomeTax / v.pretaxIncome, v.depreciation, v.capex, v.operatingWorkingCapital - before);
}
export function evaluateScenario(dataset: FinancialDataset, reportId: string, assumptions: ScenarioAssumptions): Calculation<DcfOutput> {
  const context = datasetContext(dataset, reportId); if (!context.ok) return context;
  const parsed = assumptionSchema.safeParse(assumptions); if (!parsed.success) return failure("invalid", "Giả định phải đúng schema, năm dự phóng nguyên 1–10.");
  const a = parsed.data;
  const checked = input(a.growth, a.ebitMargin, a.taxRate, a.depreciationRate, a.capexRate, a.workingCapitalRate, a.wacc, a.terminalGrowth); if (!checked.ok) return checked;
  if (a.growth! <= -1 || a.growth! > 2 || a.ebitMargin! < 0 || a.ebitMargin! > 1 || a.taxRate! < 0 || a.taxRate! > 1 || a.depreciationRate! < 0 || a.depreciationRate! > 1 || a.capexRate! < 0 || a.capexRate! > 1 || a.workingCapitalRate! < -1 || a.workingCapitalRate! > 1 || a.wacc! <= 0 || a.wacc! > 1 || a.terminalGrowth! <= -1 || a.terminalGrowth! >= a.wacc!)
    return failure("invalid", "Giả định ngoài miền hỗ trợ: −100%<tăng trưởng≤200%; biên/thuế/D&A/CAPEX trong [0,100%]; WC/doanh thu trong [−100%,100%]; 0<WACC≤100% và −100%<g<WACC.");
  const { data, report } = context.value, v = normalizeReport(report).values;
  if (v.revenue === null || v.operatingWorkingCapital === null) return failure("missing_data", "Cần doanh thu năm cơ sở và vốn lưu động hoạt động cuối kỳ.");
  if (v.revenue <= 0) return failure("not_meaningful", "Doanh thu cơ sở phải dương.");
  let revenue = v.revenue, workingCapital = v.operatingWorkingCapital;
  const projections: Projection[] = [];
  for (let i = 1; i <= a.years; i++) {
    revenue *= 1 + a.growth!;
    const ebit = revenue * a.ebitMargin!, depreciation = revenue * a.depreciationRate!, capex = revenue * a.capexRate!, nextWorkingCapital = revenue * a.workingCapitalRate!, changeWorkingCapital = nextWorkingCapital - workingCapital;
    const fcff = calculateFcff(ebit, a.taxRate, depreciation, capex, changeWorkingCapital); if (!fcff.ok) return fcff;
    const df = discountFactor(a.wacc, i); if (!df.ok) return df;
    const row = { year: report.fiscalYear + i, revenue, ebit, nopat: ebit * (1 - a.taxRate!), depreciation, capex, workingCapital: nextWorkingCapital, changeWorkingCapital, fcff: fcff.value, discountFactor: df.value, presentValue: fcff.value * df.value };
    if (!Object.values(row).every(value => finiteResult(value).ok)) return failure("invalid", "Dự phóng vượt phạm vi an toàn.");
    projections.push(row); workingCapital = nextWorkingCapital;
  }
  const bridge = reportBridge(data, report), price = data.market ? factValue(data.market.price) : null;
  const valuation = discountCashFlows(projections.map(r => r.fcff), a.wacc, a.terminalGrowth, bridge, price); if (!valuation.ok) return valuation;
  const used: CorporateField[] = ["revenue", "operatingWorkingCapital", "cash", "shortTermDebt", "longTermDebt", "nonOperatingAssets", "minorityInterest", "preferredEquity", "otherClaims", "ebit", "pretaxIncome", "incomeTax", "depreciation", "capex"];
  const opening = openingReport(data, report);
  const sourceIds = [...new Set([...used.map(k => report.fields[k].sourceId), ...(opening ? [opening.fields.operatingWorkingCapital.sourceId] : []), ...(data.market ? [data.market.price.sourceId, data.market.sharesOutstanding.sourceId] : [])])];
  return success({ ...valuation.value, projections, bridge, historicalFcff: historicalFcff(data, report), assumptions: { ...a }, provenance: { kind: "calculated", containsMock: data.sources.some(s => sourceIds.includes(s.id) && s.provenance === "mock"), sourceIds, reportId: report.id, valuationAsOf: report.endDate, marketAsOf: data.market!.asOf, currency: data.currency } }, [...valuation.warnings, `Chiết khấu về cuối kỳ ${report.endDate}; chưa roll-forward đến ngày giá tham chiếu.`, "Terminal FCFF = FCFF năm cuối × (1+g), giả định tái đầu tư/trạng thái ổn định phải được người dùng kiểm tra; chưa có mô hình ROIC giai đoạn chuyển tiếp.", "Dùng cổ phiếu lưu hành hiện tại; chưa dự phóng pha loãng/corporate actions. Không cộng trùng tiền và tài sản ngoài hoạt động."]);
}
export function sensitivity(data: FinancialDataset, reportId: string, scenario: ScenarioAssumptions): { wacc: number; growth: number; result: Calculation<DcfOutput> }[] {
  if (scenario.wacc === null || scenario.terminalGrowth === null) return [];
  return [-.02, -.01, 0, .01, .02].flatMap(dw => [-.01, -.005, 0, .005, .01].map(dg => {
    const wacc = scenario.wacc! + dw, growth = scenario.terminalGrowth! + dg;
    return { wacc, growth, result: evaluateScenario(data, reportId, { ...scenario, wacc, terminalGrowth: growth }) };
  }));
}
export function evaluateRelative(dataset: FinancialDataset, reportId: string, method: "pe" | "pb" | "evEbitda", multiple: N): Calculation<RelativeOutput> {
  const context = datasetContext(dataset, reportId); if (!context.ok) return context;
  const checked = input(multiple); if (!checked.ok) return checked;
  if (multiple! <= 0) return failure("not_meaningful", "Hệ số định giá phải dương, có căn cứ người phân tích/nhóm so sánh.");
  const { data, report } = context.value, v = normalizeReport(report).values, bridge = reportBridge(data, report), price = factValue(data.market!.price);
  const shares = bridge.sharesOutstanding;
  if (shares === null) return failure("missing_data", "Thiếu cổ phiếu lưu hành.");
  if (shares <= 0) return failure("not_meaningful", "Cổ phiếu lưu hành phải dương.");
  let result: RelativeOutput;
  if (method === "evEbitda") {
    const metrics = input(v.ebit, v.depreciation); if (!metrics.ok) return metrics;
    const ebitda = v.ebit! + v.depreciation!; if (ebitda <= 0) return failure("not_meaningful", "EBITDA không dương: không áp dụng EV/EBITDA.");
    const enterpriseValue = ebitda * multiple!, equity = equityBridge(enterpriseValue, bridge); if (!equity.ok) return equity;
    result = { enterpriseValue, ...equity.value, ...comparison(equity.value.intrinsicValuePerShare, price) };
  } else {
    const metric = method === "pe" ? v.dilutedEps : v.shareholdersEquity;
    if (metric === null) return failure("missing_data", "Thiếu EPS pha loãng hoặc vốn cổ đông thường.");
    if (metric <= 0) return failure("not_meaningful", "EPS/vốn cổ đông thường không dương: hệ số không có ý nghĩa.");
    const intrinsicValuePerShare = method === "pe" ? metric * multiple! : metric * multiple! / shares;
    result = { enterpriseValue: null, equityValue: intrinsicValuePerShare * shares, intrinsicValuePerShare, ...comparison(intrinsicValuePerShare, price) };
  }
  if (Object.values(result).some(v => v !== null && !finiteResult(v).ok)) return failure("invalid", "Định giá tương đối vượt phạm vi an toàn.");
  return success(result, ["Hệ số là giả định; cần nguồn và điều chỉnh khác biệt peer. P/E dùng EPS pha loãng năm, tổng vốn chủ suy từ giá/cp × cổ phiếu hiện tại. Không bảo đảm giá thị trường sẽ đạt kết quả."]);
}
