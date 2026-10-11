import { failure, success } from "./result";
import { FIELD_LABELS, financialDatasetSchema, normalizeReport, parseFinancialDataset } from "./schema";
import { BALANCE_FIELDS, CORPORATE_FIELDS, type Calculation, type CorporateDataset, type CorporateField, type CorporateReport, type Fact, type FinancialDataset, type FinancialSource, type InputEvidence } from "./types";

export type TtmMethod = "quarters" | "fy_ytd";
export interface TtmOutput {
  report: CorporateReport;
  inputs: InputEvidence[];
  method: string;
  /** Operand order: oldest → newest quarters, or [prior FY, current YTD, prior YTD]. */
  reportIds: string[];
  /** Register this calculated source together with the report, retaining inputs. */
  source: FinancialSource;
}

function findPeriod(data: CorporateDataset, anchor: CorporateReport, kind: CorporateReport["kind"], year: number, quarter: 1 | 2 | 3 | 4 | null): Calculation<CorporateReport> {
  const candidates = data.reports.filter(r => r.kind === kind && r.fiscalYear === year && r.fiscalQuarter === quarter);
  const matchingScope = candidates.filter(r => r.scope === anchor.scope);
  const label = `${kind} ${year}${quarter ? ` Q${quarter}` : ""}`;
  if (!matchingScope.length) return candidates.length
    ? failure("incompatible", `${label}: không có kỳ cùng phạm vi ${anchor.scope}.`)
    : failure("missing_data", `Thiếu kỳ ${label}; không thay dữ liệu thiếu bằng 0 hoặc kỳ khác.`);
  if (matchingScope.length !== 1) return failure("incompatible", `${label}: có nhiều phiên bản báo cáo; cần giải quyết phiên bản điều chỉnh trước khi tính TTM.`);
  const selected = matchingScope[0];
  if (selected.basis !== anchor.basis) return failure("incompatible", `${selected.id}: khác cơ sở kế toán/điều chỉnh so với ${anchor.id}.`);
  return success(selected);
}

function nextDay(date: string): string {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function uniqueId(base: string, used: string[], limit: number): string {
  const stem = base.slice(0, limit - 4);
  let id = stem;
  for (let index = 1; used.includes(id); index++) id = `${stem}_${index}`;
  return id;
}

/** Pure calculation. Input must remain a validated dataset of reported periods, not derived TTM reports. */
export function buildTtm(data: FinancialDataset, anchorId: string, method: TtmMethod): Calculation<TtmOutput> {
  if (method !== "quarters" && method !== "fy_ytd") return failure("invalid", "Phương pháp TTM không hợp lệ.");
  // Validate before JSON serialization: NaN/Infinity must not silently turn into null.
  const shape = financialDatasetSchema.safeParse(data);
  if (!shape.success) return failure("invalid", ...shape.error.issues.slice(0, 10).map(i => `${i.path.join(".")}: ${i.message}`));
  const checked = parseFinancialDataset(JSON.stringify(shape.data));
  if (!checked.ok) return checked;
  if (checked.value.industry !== "corporate") return failure("unsupported", "TTM hiện chỉ hỗ trợ bộ báo cáo doanh nghiệp phi tài chính; chưa ghép chỉ tiêu ngành tài chính.");
  const dataset = checked.value;
  const anchor = dataset.reports.find(r => r.id === anchorId);
  if (!anchor) return failure("missing_data", `Không tìm thấy kỳ gốc ${anchorId}.`);
  if (anchor.kind !== (method === "quarters" ? "quarter" : "ytd") || anchor.fiscalQuarter === null)
    return failure("incompatible", method === "quarters" ? "Cần kỳ gốc là quý riêng lẻ, không dùng số YTD làm một quý." : "Cần kỳ gốc là YTD có quý rõ ràng.");

  const reports: CorporateReport[] = [];
  let startDate: string;
  let description: string;
  if (method === "quarters") {
    const endIndex = anchor.fiscalYear * 4 + anchor.fiscalQuarter - 1;
    for (let index = endIndex - 3; index <= endIndex; index++) {
      const selected = findPeriod(dataset, anchor, "quarter", Math.floor(index / 4), (index % 4 + 1) as 1 | 2 | 3 | 4);
      if (!selected.ok) return selected;
      reports.push(selected.value);
    }
    startDate = reports[0].startDate;
    description = `CALCULATED TTM · Bốn quý riêng lẻ liên tiếp: ${reports.map(r => r.id).join(" + ")}`;
  } else {
    const requested = [
      findPeriod(dataset, anchor, "annual", anchor.fiscalYear - 1, null),
      findPeriod(dataset, anchor, "ytd", anchor.fiscalYear, anchor.fiscalQuarter),
      findPeriod(dataset, anchor, "ytd", anchor.fiscalYear - 1, anchor.fiscalQuarter),
    ];
    for (const selected of requested) {
      if (!selected.ok) return selected;
      reports.push(selected.value);
    }
    startDate = nextDay(reports[2].endDate);
    description = `CALCULATED TTM · FY trước + YTD hiện tại − YTD cùng kỳ trước: ${reports[0].id} + ${reports[1].id} − ${reports[2].id}`;
  }

  const normalized = reports.map(normalizeReport);
  const closing = normalizeReport(anchor);
  const inputs: InputEvidence[] = [];
  const sourceId = uniqueId(`CALC_TTM_${anchor.id}_${method}`, dataset.sources.map(s => s.id), 40);
  const fields = {} as Record<CorporateField, Fact>;
  const missing: string[] = [];
  for (const key of CORPORATE_FIELDS) {
    const isBalance = (BALANCE_FIELDS as readonly string[]).includes(key);
    const operands = isBalance ? [closing] : normalized;
    inputs.push(...operands.map(r => ({ key, value: r.values[key], sourceId: r.facts[key].sourceId, locator: r.facts[key].locator, periodId: r.id })));
    let value: number | null = null;
    if (key !== "dilutedEps") {
      if (operands.some(r => r.values[key] === null)) missing.push(FIELD_LABELS[key]);
      else if (isBalance) value = closing.values[key];
      else {
        value = 0;
        for (let i = 0; i < operands.length; i++) {
          value += operands[i].values[key]! * (method === "fy_ytd" && i === 2 ? -1 : 1);
          if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) return failure("invalid", `${FIELD_LABELS[key]}: phép tính TTM vượt phạm vi số an toàn.`);
        }
        if ((key === "capex" || key === "depreciation") && value < 0)
          return failure("incompatible", `${FIELD_LABELS[key]} TTM âm trái quy ước số dương của dữ liệu đầu vào; cần đối chiếu số liệu và cơ sở điều chỉnh.`);
      }
    }
    fields[key] = { value, unit: "unit", sourceId, locator: key === "dilutedEps" ? "CALCULATED TTM: EPS không tính; thiếu cơ sở cổ phiếu bình quân gia quyền tương thích." : `CALCULATED TTM: ${key}; ${isBalance ? `số dư cuối kỳ ${anchor.id}` : method}; truy vết đầy đủ trong inputs[key].` };
  }

  const inputSourceIds = new Set(inputs.map(i => i.sourceId));
  const sources = dataset.sources.filter(s => inputSourceIds.has(s.id));
  const containsMock = sources.some(s => s.provenance === "mock");
  const source: FinancialSource = {
    id: sourceId, title: `CALCULATED TTM · ${dataset.symbol} · ${anchor.endDate}`, url: "",
    accessedAt: sources.map(s => s.accessedAt).sort().at(-1)!, provenance: containsMock ? "mock" : "user_supplied",
  };
  const report: CorporateReport = {
    id: uniqueId(`TTM_${method}_${anchor.id}`, dataset.reports.map(r => r.id), 60),
    // Temporary compatibility tag, never an assertion of a reported/audited fiscal year.
    kind: "annual", fiscalYear: anchor.fiscalYear, fiscalQuarter: null,
    startDate, endDate: anchor.endDate, scope: anchor.scope, basis: anchor.basis,
    publishedAt: reports.map(r => r.publishedAt).sort().at(-1)!, audited: "unaudited", fields,
  };
  const warnings = [
    "CALCULATED TTM là số liệu suy ra từ các kỳ đã nhập, không phải báo cáo năm do doanh nghiệp công bố hoặc đã kiểm toán.",
    "Chỉ cộng/trừ chỉ tiêu dòng lợi nhuận và dòng tiền; số dư tài sản, nợ và vốn giữ tại cuối kỳ gốc.",
    "EPS TTM để null: không cộng/trừ EPS các kỳ và không dùng số cổ phiếu tại một thời điểm thay bình quân gia quyền.",
    "Nhãn kind=annual chỉ tương thích nội bộ tạm thời; giữ method, reportIds, inputs và source, không nhập kết quả này như báo cáo FY gốc.",
    containsMock ? "TTM có đầu vào MOCK; mọi kết quả dẫn xuất tiếp tục là MOCK." : "Nguồn do người dùng cung cấp; chưa xác minh nội dung hoặc tính đầy đủ của điều chỉnh kế toán.",
  ];
  if (missing.length) warnings.push(`Giữ null vì thiếu đầu vào: ${missing.join(", ")}.`);
  return success({ report, inputs, method: description, reportIds: reports.map(r => r.id), source }, warnings);
}
