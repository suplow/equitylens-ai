"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calculator, Database, Download, ExternalLink, FileJson, FlaskConical, FolderOpen, Save, Upload } from "lucide-react";
import type { Stock } from "@/lib/data/types";
import { number } from "@/lib/format";
import { MAX_FINANCIAL_JSON_BYTES, useFinancialDataset } from "@/hooks/use-financial-dataset";
import { convertYtdToQuarter, createDatasetTemplate, FIELD_LABELS, normalizeReport } from "@/lib/financial/schema";
import { analyzeRatios, freeCashFlow, getDatasetWarnings, getHistoricalRows } from "@/lib/financial/ratios";
import { BALANCE_FIELDS, CASH_FIELDS, INCOME_FIELDS, type CorporateDataset, type FinancialDataset, type Industry, type RatioResult } from "@/lib/financial/types";
import { defaultScenarios, evaluateRelative, evaluateScenario, parseScenarios, sensitivity, type ScenarioAssumptions, type DcfOutput } from "@/lib/financial/valuation";
import { parsePeers, peerMedian, type PeerInput } from "@/lib/financial/peers";
import { Button } from "./ui/button";
import { Panel } from "./shared";
import "./financial-engine.css";

type DataState = ReturnType<typeof useFinancialDataset>;
type View = "financials" | "valuation";
const industryNames: Record<Industry, string> = { corporate: "Doanh nghiệp phi tài chính", bank: "Ngân hàng", securities: "Chứng khoán", insurance: "Bảo hiểm" };
const unitNames = { unit: "đơn vị", thousand: "nghìn", million: "triệu", billion: "tỷ" };
const scopeNames = { consolidated: "Hợp nhất", standalone: "Riêng lẻ" };
const kindNames = { annual: "Năm", quarter: "Quý đơn lẻ", ytd: "Lũy kế" };
const auditNames = { audited: "Đã kiểm toán", reviewed: "Đã soát xét", unaudited: "Chưa kiểm toán", unknown: "Chưa rõ kiểm toán" };
function industryFor(stock: Stock): Industry { return stock.sector === "Ngân hàng" ? "bank" : "corporate"; }
function hasMock(dataset: FinancialDataset) { return dataset.sources.some((source) => source.provenance === "mock"); }
function amount(value: number | null, currency: string) { return value === null ? "—" : number(value / (currency === "VND" ? 1e9 : 1e6), 2); }
function amountUnit(currency: string) { return `${currency === "VND" ? "Tỷ" : "Triệu"} ${currency}`; }
function percent(value: number | null) { return value === null ? "—" : `${number(value * 100, 2)}%`; }
function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DatasetInput({ stock, state }: { stock: Stock; state: DataState }) {
  const [loading, setLoading] = useState(false);
  const industry = industryFor(stock);
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > MAX_FINANCIAL_JSON_BYTES) { state.setIssues(["Tệp JSON vượt quá 1 MB."]); return; }
    setLoading(true);
    try { state.apply(await file.text()); }
    catch { state.setIssues(["Không đọc được tệp. Hãy chọn tệp JSON văn bản UTF-8."]); }
    finally { setLoading(false); }
  }
  return <Panel title="Dữ liệu tài chính local" subtitle="Nhập JSON có nguồn, kỳ báo cáo và đơn vị. Không tự lấy số liệu từ dashboard." className="fe-data-panel">
    <div className="fe-body">
      <div className="fe-toolbar">
        <label className={`button button-outline fe-file-label ${loading ? "fe-disabled" : ""}`}><Upload size={15} aria-hidden="true" />{loading ? "Đang đọc tệp…" : "Nhập tệp JSON"}<input aria-label="Chọn tệp dữ liệu tài chính JSON" type="file" accept=".json,application/json" onChange={importFile} disabled={loading} /></label>
        <Button variant="outline" onClick={state.load}><FolderOpen size={15} aria-hidden="true" />Tải bản đã lưu</Button>
        <Button variant="outline" onClick={() => downloadJson(`${stock.symbol}-financial-template.json`, createDatasetTemplate(stock.symbol, industry))}><Download size={15} aria-hidden="true" />Tải mẫu JSON trống</Button>
        <Button variant="ghost" onClick={() => state.apply(JSON.stringify(createDatasetTemplate(stock.symbol, industry, true), null, 2))}><FlaskConical size={15} aria-hidden="true" />Nạp dữ liệu MOCK</Button>
      </div>
      <details className="fe-json-editor" open={!state.dataset}>
        <summary>Dán hoặc chỉnh sửa JSON đầu vào</summary>
        <div className="fe-field"><label htmlFor="financial-json">JSON dữ liệu tài chính</label><textarea id="financial-json" rows={8} maxLength={1000000} spellCheck={false} value={state.raw} onChange={(e) => state.edit(e.target.value)} placeholder={'{\n  "version": "2.0",\n  "symbol": "' + stock.symbol + '",\n  ...\n}'} /></div>
        <Button onClick={() => state.apply()} disabled={!state.raw.trim() || loading}><FileJson size={15} aria-hidden="true" />Kiểm tra & áp dụng JSON</Button>
      </details>
      {state.dirty && <p className="fe-warning">JSON đã thay đổi hoặc chưa hợp lệ. Áp dụng dữ liệu trước khi tính toán và lưu.</p>}
      {state.issues.length > 0 && <div className="fe-errors" role="alert"><strong>Chưa thể dùng dữ liệu</strong><ul>{state.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
      {state.message && <p className="fe-status" role="status">{state.message}</p>}
      {state.dataset && <div className="fe-save-row"><p>Lưu chủ động trong trình duyệt theo mã {stock.symbol}. Tải JSON để sao lưu; lưu trước khi chuyển trang hoặc đổi chế độ.</p><Button variant="outline" onClick={state.save}><Save size={14} aria-hidden="true" />Lưu dữ liệu local</Button><Button variant="outline" onClick={() => downloadJson(`${stock.symbol}-financial-data.json`, state.dataset)}><Download size={14} aria-hidden="true" />Xuất JSON dữ liệu</Button></div>}
    </div>
  </Panel>;
}

function DatasetSummary({ dataset, reportId, onReport }: { dataset: FinancialDataset; reportId: string; onReport: (id: string) => void }) {
  const report = dataset.reports.find((item) => item.id === reportId);
  const warnings = getDatasetWarnings(dataset);
  return <>
    <div className="fe-dataset-bar"><div><strong>{dataset.symbol} · {dataset.name}</strong><p>{industryNames[dataset.industry]} · Tiền tệ {dataset.currency} · {dataset.reports.length} kỳ báo cáo</p></div><span className={`badge ${hasMock(dataset) ? "mock-badge" : ""}`}>{hasMock(dataset) ? "MOCK · CẢ KẾT QUẢ TÍNH" : "NGUỒN TỰ NHẬP · CHƯA XÁC MINH"}</span></div>
    <div className="fe-period-row"><label className="fe-field">Kỳ phân tích<select value={reportId} onChange={(e) => onReport(e.target.value)}>{dataset.reports.map((item) => <option key={item.id} value={item.id}>{kindNames[item.kind]} {item.fiscalYear}{item.fiscalQuarter ? ` · Q${item.fiscalQuarter}` : ""} · {item.id}</option>)}</select></label>{report && <p>{report.startDate} → {report.endDate}<br />{scopeNames[report.scope]} · {auditNames[report.audited]} · Công bố {report.publishedAt || "chưa rõ"}<br />Cơ sở so sánh: {report.basis}</p>}</div>
    {warnings.length > 0 && <details className="fe-warnings"><summary>{warnings.length} lưu ý về chất lượng / khả năng so sánh dữ liệu</summary><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
  </>;
}

function YtdPreview({ dataset, reportId }: { dataset: CorporateDataset; reportId: string }) {
  const report = dataset.reports.find((item) => item.id === reportId);
  if (!report || report.kind !== "ytd" || !report.fiscalQuarter) return null;
  const prior = dataset.reports.find((item) => item.kind === "ytd" && item.fiscalYear === report.fiscalYear && item.fiscalQuarter === report.fiscalQuarter! - 1 && item.scope === report.scope) ?? null;
  const result = convertYtdToQuarter(report, prior);
  return <details className="fe-ytd-preview"><summary>Xem dòng quý từ YTD</summary><p>Chỉ xem kết quả chuyển đổi; giữ nguyên JSON nhập. Đầu vào: {report.id}{prior ? ` và ${prior.id}` : ""}.</p>{result.ok ? <><p>Kỳ quý: {result.value.startDate} → {result.value.endDate} · {amountUnit(dataset.currency)} · Calculated{hasMock(dataset) ? " · MOCK" : " · Nguồn chưa xác minh"}</p><div className="table-scroll"><table><thead><tr><th>CHỈ TIÊU</th><th>DÒNG QUÝ SUY RA</th></tr></thead><tbody>{[...CASH_FIELDS, "dilutedEps" as const].map((field) => <tr key={field}><td>{FIELD_LABELS[field]}</td><td>{field === "dilutedEps" ? result.value.values[field] === null ? "—" : `${number(result.value.values[field], 2)} ${dataset.currency}/CP` : amount(result.value.values[field], dataset.currency)}</td></tr>)}</tbody></table></div><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></> : <p className="fe-warning">{result.issues.join(" ")}</p>}</details>;
}

function FinancialStatements({ dataset, reportId }: { dataset: CorporateDataset; reportId: string }) {
  const [tab, setTab] = useState(0);
  const statements = [{ label: "Kết quả kinh doanh", fields: INCOME_FIELDS }, { label: "Bảng cân đối kế toán", fields: BALANCE_FIELDS }, { label: "Lưu chuyển tiền tệ", fields: CASH_FIELDS }];
  const normalized = dataset.reports.map(normalizeReport);
  return <Panel title="Báo cáo tài chính chuẩn hóa" subtitle={`${amountUnit(dataset.currency)} · EPS riêng theo ${dataset.currency}/cổ phiếu · — là thiếu dữ liệu`} className="section-gap">
    <div className="statement-tabs" aria-label="Loại báo cáo engine">{statements.map((statement, index) => <button key={statement.label} aria-pressed={tab === index} onClick={() => setTab(index)}>{statement.label}</button>)}</div>
    <div className="table-scroll"><table className="fe-statement-table"><thead><tr><th>CHỈ TIÊU</th>{normalized.map((report) => <th key={report.id}>{report.id}<small>{kindNames[report.kind]} · {report.endDate}</small></th>)}</tr></thead><tbody>{statements[tab].fields.map((field) => <tr key={field}><td>{FIELD_LABELS[field]}</td>{normalized.map((report) => <td key={report.id}><details className="fe-fact"><summary>{field === "dilutedEps" ? report.values[field] === null ? "—" : number(report.values[field], 2) : amount(report.values[field], dataset.currency)}</summary><div><strong>{report.facts[field].sourceId || "Chưa có nguồn"}</strong><br />{report.facts[field].locator || "Chưa có vị trí"}<br />Đầu vào: {report.facts[field].value === null ? "null" : number(report.facts[field].value, 2)} · {unitNames[report.facts[field].unit]}<br />{scopeNames[report.scope]} · {report.publishedAt || "Chưa rõ ngày công bố"}</div></details></td>)}</tr>)}{tab === 2 && <tr><td>FCF đơn giản = CFO − CAPEX</td>{normalized.map((report) => { const result = freeCashFlow(report.values.cfo, report.values.capex); return <td key={report.id}><details className="fe-fact"><summary>{result.ok ? amount(result.value, dataset.currency) : "—"}</summary><div>Calculated{hasMock(dataset) ? " · MOCK" : " · Nguồn chưa xác minh"}<br />CFO: {report.facts.cfo.sourceId} · {report.facts.cfo.locator}<br />CAPEX: {report.facts.capex.sourceId} · {report.facts.capex.locator}<br />{result.ok ? "Không phải FCFF; chưa điều chỉnh lãi vay và thuế." : result.issues.join(" ")}</div></details></td>; })}</tr>}</tbody></table></div>
    <YtdPreview dataset={dataset} reportId={reportId} />
    <p className="fe-footnote">Mở từng ô để đối chiếu đầu vào và nguồn. Chuẩn hóa đơn vị không xác minh tính đúng đắn của báo cáo.</p>
  </Panel>;
}

function HistoricalComparison({ dataset }: { dataset: CorporateDataset }) {
  const rows = getHistoricalRows(dataset);
  return <Panel title="So sánh lịch sử" subtitle={`Chỉ kỳ năm cùng phạm vi và cơ sở điều chỉnh mới nhất · ${amountUnit(dataset.currency)}`} className="section-gap">
    <div className="fe-history-chart" role="img" aria-label="Biểu đồ doanh thu, lợi nhuận và dòng tiền từ dữ liệu đã nhập"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 680, height: 280 }}><BarChart data={rows} barGap={4}><CartesianGrid vertical={false} stroke="#283344" strokeDasharray="3 5" /><XAxis dataKey="period" tick={{ fill: "#a0acc0", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#a0acc0", fontSize: 10 }} tickFormatter={(value) => amount(Number(value), dataset.currency)} width={65} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#172232", border: "1px solid #354459", borderRadius: 6, color: "#edf1f7" }} formatter={(value) => `${amount(Number(value), dataset.currency)} ${amountUnit(dataset.currency)}`} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} /><Bar name="Doanh thu" dataKey="revenue" fill="#77dfc2" isAnimationActive={false} maxBarSize={30} /><Bar name="LN sau thuế" dataKey="netIncome" fill="#5b7f9e" isAnimationActive={false} maxBarSize={30} /><Bar name="CFO" dataKey="cfo" fill="#b6a584" isAnimationActive={false} maxBarSize={30} /></BarChart></ResponsiveContainer></div>
    <div className="table-scroll"><table><thead><tr><th>KỲ</th><th>DOANH THU</th><th>LN SAU THUẾ</th><th>CFO</th></tr></thead><tbody>{rows.map((row) => <tr key={row.period}><td>{row.period}</td><td>{amount(row.revenue, dataset.currency)}</td><td>{amount(row.netIncome, dataset.currency)}</td><td>{amount(row.cfo, dataset.currency)}</td></tr>)}</tbody></table></div>
  </Panel>;
}

function RatioTable({ dataset, reportId }: { dataset: FinancialDataset; reportId: string }) {
  const ratios = analyzeRatios(dataset, reportId);
  function display(ratio: RatioResult) {
    if (!ratio.result.ok) return "—";
    if (ratio.unit === "percent") return percent(ratio.result.value);
    return `${number(ratio.result.value, 2)}${ratio.unit === "times" ? "x" : ratio.unit === "days" ? " ngày" : ` ${dataset.currency}`}`;
  }
  return <Panel title="Chỉ số tài chính & công thức" subtitle="Calculated Metrics · Không chấm điểm sức khỏe doanh nghiệp bằng một con số" className="section-gap">
    {ratios.length === 0 ? <p className="fe-empty">Chưa có bộ chỉ số phù hợp cho loại doanh nghiệp này.</p> : <div className="fe-ratios">{ratios.map((ratio) => <article className="fe-ratio" key={ratio.id}><div className="fe-ratio-top"><div><span className="fe-overline">{ratio.group}</span><h3>{ratio.label}</h3></div><strong className="fe-ratio-value">{display(ratio)}</strong></div><p className="fe-ratio-status">{ratio.result.ok ? (ratio.provenance.containsMock ? "Calculated · MOCK" : "Calculated · Nguồn chưa xác minh") : ratio.result.issues.join(" ")}</p><details><summary>Công thức, đầu vào & giới hạn</summary><code>{ratio.formula}</code><p>{ratio.meaning}</p><p className="fe-muted">{ratio.limitations}</p><ul>{ratio.inputs.map((input, index) => <li key={index}><strong>{input.key}</strong>: {input.value === null ? "thiếu" : number(input.value, 4)} · {input.periodId} · {input.sourceId || "chưa có nguồn"} · {input.locator}</li>)}</ul>{ratio.result.warnings.length > 0 && <ul>{ratio.result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}</details></article>)}</div>}
  </Panel>;
}

const assumptionFields: { key: keyof Omit<ScenarioAssumptions, "name" | "years">; label: string; percent: boolean }[] = [
  { key: "growth", label: "Tăng trưởng doanh thu", percent: true },
  { key: "ebitMargin", label: "Biên EBIT", percent: true },
  { key: "taxRate", label: "Thuế suất", percent: true },
  { key: "depreciationRate", label: "D&A / Doanh thu", percent: true },
  { key: "capexRate", label: "CAPEX / Doanh thu", percent: true },
  { key: "workingCapitalRate", label: "Vốn lưu động HĐ / Doanh thu", percent: true },
  { key: "wacc", label: "WACC", percent: true },
  { key: "terminalGrowth", label: "Tăng trưởng dài hạn", percent: true },
  { key: "peMultiple", label: "P/E tham chiếu", percent: false },
  { key: "pbMultiple", label: "P/B tham chiếu", percent: false },
  { key: "evEbitdaMultiple", label: "EV/EBITDA tham chiếu", percent: false },
];

function AssumptionsEditor({ scenarios, onChange, isMock }: { scenarios: ScenarioAssumptions[]; onChange: (next: ScenarioAssumptions[]) => void; isMock: boolean }) {
  function update(index: number, key: keyof Omit<ScenarioAssumptions, "name" | "years">, value: string, isPercent: boolean) {
    const parsed = value.trim() === "" ? null : Number(value) / (isPercent ? 100 : 1);
    onChange(scenarios.map((scenario, i) => i === index ? { ...scenario, [key]: parsed } : scenario));
  }
  return <Panel title="Bear / Base / Bull · Giả định của bạn" subtitle="Analyst Assumptions · Thay đổi đầu vào để tính lại ngay. Ô trống là thiếu dữ liệu." className="section-gap">
    <div className="fe-body"><div className="fe-assumption-actions"><p className="fe-muted">Ba kịch bản không mang xác suất xảy ra. Tỷ lệ nhập theo %, hệ số nhập theo lần.</p>{isMock && <Button variant="outline" onClick={() => onChange(defaultScenarios(true))}><FlaskConical size={14} aria-hidden="true" />Nạp giả định MOCK</Button>}</div></div>
    <div className="table-scroll"><table className="fe-assumptions-table"><thead><tr><th>GIẢ ĐỊNH</th>{scenarios.map((scenario) => <th key={scenario.name}>{scenario.name}</th>)}</tr></thead><tbody><tr><td>Số năm dự báo</td>{scenarios.map((scenario, index) => <td key={scenario.name}><input aria-label={`${scenario.name} · Số năm dự báo`} type="number" min={1} max={10} step={1} value={scenario.years} onChange={(e) => onChange(scenarios.map((item, i) => i === index ? { ...item, years: Number(e.target.value) } : item))} /></td>)}</tr>{assumptionFields.map((field) => <tr key={field.key}><td>{field.label} <span className="fe-muted">{field.percent ? "(%)" : "(x)"}</span></td>{scenarios.map((scenario, index) => <td key={scenario.name}><input aria-label={`${scenario.name} · ${field.label}`} type="number" step="any" value={scenario[field.key] === null ? "" : Number((scenario[field.key]! * (field.percent ? 100 : 1)).toPrecision(12))} onChange={(e) => update(index, field.key, e.target.value, field.percent)} placeholder="Chưa nhập" /></td>)}</tr>)}</tbody></table></div>
  </Panel>;
}

function ScenarioStorage({ dataset, reportId, scenarios, onApply }: { dataset: FinancialDataset; reportId: string; scenarios: ScenarioAssumptions[]; onApply: (next: ScenarioAssumptions[]) => void }) {
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const key = `equitylens.scenarios.v2.${dataset.symbol}.${reportId}`;
  const bundle = { symbol: dataset.symbol, reportId, containsMock: hasMock(dataset), scenarios };
  function apply(raw: string) {
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { setIssues(["JSON giả định không hợp lệ."]); return; }
    if (!Array.isArray(payload)) {
      if (!payload || typeof payload !== "object" || !("symbol" in payload) || !("reportId" in payload) || !("containsMock" in payload) || !("scenarios" in payload) || typeof payload.containsMock !== "boolean") { setIssues(["Cần mảng kịch bản hoặc tệp giả định được xuất từ ứng dụng."]); return; }
      if (payload.symbol !== dataset.symbol || payload.reportId !== reportId) { setIssues(["Tệp giả định không khớp mã cổ phiếu hoặc kỳ đang phân tích."]); return; }
      if (payload.containsMock && !hasMock(dataset)) { setIssues(["Giả định lưu từ bộ MOCK chỉ được nạp lại vào bộ dữ liệu MOCK."]); return; }
      payload = payload.scenarios;
    }
    const result = parseScenarios(JSON.stringify(payload));
    if (!result.ok) { setIssues(result.issues); setMessage(""); return; }
    onApply(result.value); setIssues([]); setDraft(""); setMessage("Đã áp dụng 3 kịch bản. Đây là giả định của người phân tích.");
  }
  function save() {
    const result = parseScenarios(JSON.stringify(scenarios));
    if (!result.ok) { setIssues(result.issues); return; }
    try { localStorage.setItem(key, JSON.stringify({ ...bundle, scenarios: result.value })); setIssues([]); setMessage(`Đã lưu giả định cho ${dataset.symbol} · ${reportId} trong trình duyệt.`); }
    catch { setIssues(["Không lưu được giả định. Hãy tải JSON để giữ bản sao."]); }
  }
  function load() {
    try { const raw = localStorage.getItem(key); if (raw) apply(raw); else setMessage(`Chưa có giả định đã lưu cho ${dataset.symbol} · ${reportId}.`); }
    catch { setIssues(["Không đọc được giả định đã lưu."]); }
  }
  return <details className="fe-scenario-storage"><summary>Lưu / nhập lại giả định theo mã và kỳ</summary><div className="fe-toolbar"><Button variant="outline" onClick={save}><Save size={14} aria-hidden="true" />Lưu giả định local</Button><Button variant="outline" onClick={load}><FolderOpen size={14} aria-hidden="true" />Tải giả định đã lưu</Button><Button variant="outline" onClick={() => downloadJson(`${dataset.symbol}-${reportId}-scenarios.json`, bundle)}><Download size={14} aria-hidden="true" />Tải giả định JSON</Button></div><div className="fe-field"><label htmlFor="financial-scenario-json">JSON giả định (tệp lưu hoặc mảng Bear / Base / Bull)</label><textarea id="financial-scenario-json" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={20000} placeholder="Dán nội dung JSON từ tệp giả định đã tải..." /></div><Button variant="outline" disabled={!draft.trim()} onClick={() => apply(draft)}>Áp dụng JSON giả định</Button>{message && <p className="fe-status" role="status">{message}</p>}{issues.length > 0 && <div className="fe-errors" role="alert"><ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}</details>;
}

function PeerComparison({ dataset, reportId, onApply }: { dataset: FinancialDataset; reportId: string; onApply: (method: "pe" | "pb" | "evEbitda", value: number, containsMock: boolean) => void }) {
  const [raw, setRaw] = useState("[]");
  const [peers, setPeers] = useState<PeerInput[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  function apply() {
    const result = parsePeers(raw);
    if (!result.ok) { setIssues(result.issues); return; }
    setPeers(result.value); setIssues([]); setMessage("Đã áp dụng danh sách so sánh. Nguồn và khả năng tương đồng cần được đối chiếu.");
  }
  const mockPeersBlocked = !hasMock(dataset) && peers.some((peer) => peer.source.provenance === "mock");
  return <Panel title="Comparable Company Analysis" subtitle={`Nhóm so sánh do bạn cung cấp · Cùng ngành và kỳ ${reportId} · Không tự tạo doanh nghiệp hoặc hệ số`} className="section-gap"><div className="fe-body">
    <details className="fe-json-editor"><summary>Nhập JSON doanh nghiệp so sánh</summary><p className="fe-muted small">Mỗi mục cần symbol, industry, period, source, pe, pb, evEbitda, selectionReason và differences (size, growth, profitability, capitalStructure). Không có dữ liệu giữ danh sách [] hoặc chỉ số null.</p><div className="fe-field"><label htmlFor="financial-peer-json">JSON doanh nghiệp so sánh</label><textarea id="financial-peer-json" rows={8} maxLength={100000} spellCheck={false} value={raw} onChange={(e) => { setRaw(e.target.value); setPeers([]); setMessage(""); setIssues([]); }} /></div><div className="fe-toolbar"><Button variant="outline" onClick={apply}>Kiểm tra danh sách so sánh</Button><Button variant="ghost" onClick={() => downloadJson(`${dataset.symbol}-peers-empty.json`, [])}><Download size={14} aria-hidden="true" />Tải danh sách trống</Button></div></details>
    {issues.length > 0 && <div className="fe-errors" role="alert"><ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}{message && <p className="fe-status" role="status">{message}</p>}{mockPeersBlocked && <p className="fe-warning">Nhóm so sánh chứa MOCK chỉ được áp dụng vào bộ dữ liệu MOCK.</p>}
    {peers.length === 0 ? <p className="fe-empty">Chưa có doanh nghiệp so sánh. Cần dữ liệu hệ số có nguồn và giải thích lý do chọn từng doanh nghiệp.</p> : <><div className="fe-peer-list">{peers.map((peer, index) => <article key={`${peer.symbol}-${index}`}><div className="fe-peer-heading"><h3>{peer.symbol} · {peer.period}</h3><span className={`badge ${peer.source.provenance === "mock" ? "mock-badge" : ""}`}>{peer.source.provenance === "mock" ? "MOCK" : "CHƯA XÁC MINH"}</span></div><p>{industryNames[peer.industry]} · P/E {peer.pe === null ? "—" : `${number(peer.pe, 2)}x`} · P/B {peer.pb === null ? "—" : `${number(peer.pb, 2)}x`} · EV/EBITDA {peer.evEbitda === null ? "—" : `${number(peer.evEbitda, 2)}x`}</p><p><strong>Lý do chọn:</strong> {peer.selectionReason}</p><details><summary>Khác biệt & nguồn</summary><dl>{([['Quy mô', peer.differences.size], ['Tăng trưởng', peer.differences.growth], ['Sinh lời', peer.differences.profitability], ['Cấu trúc vốn', peer.differences.capitalStructure]]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{peer.source.title} · {peer.source.asOf}</p>{peer.source.url && <a href={peer.source.url} target="_blank" rel="noopener noreferrer">Mở nguồn <ExternalLink size={12} aria-hidden="true" /></a>}</details></article>)}</div><div className="fe-peer-medians">{([{ method: "pe", label: "P/E" }, { method: "pb", label: "P/B" }, { method: "evEbitda", label: "EV/EBITDA" }] as const).map((item) => { const result = peerMedian(peers, item.method, dataset.industry, reportId); return <div key={item.method}><h3>Trung vị {item.label}</h3><strong>{result.ok ? `${number(result.value, 2)}x` : "—"}</strong>{!result.ok && <p>{result.issues.join(" ")}</p>}{result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}<Button variant="outline" size="sm" disabled={!result.ok || mockPeersBlocked} onClick={() => { if (result.ok && !mockPeersBlocked) { onApply(item.method, result.value, peers.some((peer) => peer.source.provenance === "mock")); setMessage(`Đã đưa trung vị ${item.label} vào kịch bản đang chọn. Đây là giả định, không phải giá trị được xác minh.`); } }}>Áp dụng trung vị {item.label}</Button></div>; })}</div></>}
  </div></Panel>;
}

function DcfBreakdown({ output, currency }: { output: DcfOutput; currency: string }) {
  return <>
    <div className="fe-historical-fcff"><h3>FCFF lịch sử · Đối chiếu dòng tiền cơ sở</h3><strong>{output.historicalFcff.ok ? `${amount(output.historicalFcff.value, currency)} ${amountUnit(currency)}` : "—"}</strong><p>{output.historicalFcff.ok ? "Calculated từ EBIT, thuế, D&A, CAPEX và thay đổi vốn lưu động hoạt động. DCF dự phóng sử dụng giả định đã nhập." : output.historicalFcff.issues.join(" ")}</p><p>{output.provenance.containsMock ? "MOCK · Chỉ dùng luyện tập" : "Nguồn chưa xác minh"} · {output.provenance.reportId}</p></div>
    <Panel action={<span className={`badge ${output.provenance.containsMock ? "mock-badge" : ""}`}>{output.provenance.containsMock ? "CALCULATED · MOCK" : "CALCULATED · CHƯA XÁC MINH"}</span>} title="Dự phóng FCFF & chiết khấu" subtitle={`${amountUnit(currency)} · Chiết khấu cuối năm · FCFF không phải CFO − CAPEX`} className="section-gap"><div className="table-scroll"><table><thead><tr><th>NĂM</th><th>DOANH THU</th><th>EBIT</th><th>NOPAT</th><th>D&A</th><th>CAPEX</th><th>Δ VỐN LĐ</th><th>FCFF</th><th>HỆ SỐ CK</th><th>PV FCFF</th></tr></thead><tbody>{output.projections.map((row) => <tr key={row.year}><td>{row.year}</td><td>{amount(row.revenue, currency)}</td><td>{amount(row.ebit, currency)}</td><td>{amount(row.nopat, currency)}</td><td>{amount(row.depreciation, currency)}</td><td>{amount(row.capex, currency)}</td><td>{amount(row.changeWorkingCapital, currency)}</td><td>{amount(row.fcff, currency)}</td><td>{number(row.discountFactor, 4)}</td><td>{amount(row.presentValue, currency)}</td></tr>)}</tbody></table></div><p className="fe-footnote">FCFF = EBIT × (1 − thuế suất) + D&A − CAPEX − thay đổi vốn lưu động hoạt động.<br />Kỳ: {output.provenance.reportId} · Giá tham chiếu: {output.provenance.marketAsOf} · Nguồn: {output.provenance.sourceIds.join(", ")}</p></Panel>
    <Panel title="Từ giá trị doanh nghiệp đến cổ đông" subtitle={`${amountUnit(currency)} · Mọi thành phần cầu nối phải được khai báo, kể cả khi bằng 0`} className="section-gap"><dl className="fe-bridge">{[
      ["PV dòng tiền dự báo", output.pvForecast], ["Giá trị cuối kỳ (chưa chiết khấu)", output.terminalValue], ["PV giá trị cuối kỳ", output.pvTerminal], ["Giá trị doanh nghiệp (EV)", output.enterpriseValue], ["+ Tiền", output.bridge.cash], ["+ Tài sản ngoài hoạt động", output.bridge.nonOperatingAssets], ["− Nợ vay", output.bridge.debt], ["− Lợi ích không kiểm soát", output.bridge.minorityInterest], ["− Vốn ưu đãi", output.bridge.preferredEquity], ["− Quyền lợi khác", output.bridge.otherClaims], ["Giá trị vốn cổ đông phổ thông", output.equityValue],
    ].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{amount(Number(value), currency)}</dd></div>)}</dl><p className="fe-footnote">Số cổ phiếu: {output.bridge.sharesOutstanding === null ? "—" : number(output.bridge.sharesOutstanding)} · Tỷ trọng PV cuối kỳ trong EV: {percent(output.terminalContribution)}. Kết quả có điều kiện theo nguồn và giả định.</p></Panel>
  </>;
}

function ValuationAnalysis({ dataset, reportId }: { dataset: FinancialDataset; reportId: string }) {
  const [scenarios, setScenarios] = useState(() => defaultScenarios());
  const [selected, setSelected] = useState<ScenarioAssumptions["name"]>("Base");
  const [mockPeerApplied, setMockPeerApplied] = useState(false);
  const scenario = scenarios.find((item) => item.name === selected)!;
  const results = scenarios.map((item) => ({ name: item.name, result: evaluateScenario(dataset, reportId, item) }));
  const current = results.find((item) => item.name === selected)!.result;
  const cells = current.ok ? sensitivity(dataset, reportId, scenario) : [];
  const waccs = [...new Set(cells.map((cell) => cell.wacc))];
  const growths = [...new Set(cells.map((cell) => cell.growth))];
  return <>
    <AssumptionsEditor scenarios={scenarios} onChange={setScenarios} isMock={hasMock(dataset)} />
    <ScenarioStorage dataset={dataset} reportId={reportId} scenarios={scenarios} onApply={setScenarios} />
    {(hasMock(dataset) || mockPeerApplied) && <p className="fe-warning fe-calculation-provenance">MOCK · Kết quả bên dưới chứa dữ liệu hoặc giả định từ nguồn minh họa, chỉ dùng luyện tập.</p>}
    <Panel title="Kết quả DCF–FCFF" subtitle="Calculated Metrics + Analyst Assumptions · Không phải giá mục tiêu hay khuyến nghị" className="section-gap"><div className="table-scroll"><table><thead><tr><th>KỊCH BẢN</th><th>EV · {amountUnit(dataset.currency)}</th><th>VỐN CHỦ · {amountUnit(dataset.currency)}</th><th>GIÁ TRỊ / CỔ PHIẾU</th><th>CHÊNH LỆCH / GIÁ</th><th>BIÊN AN TOÀN</th><th>ĐIỀU KIỆN</th></tr></thead><tbody>{results.map(({ name, result }) => <tr key={name}><td>{name}</td><td>{result.ok ? amount(result.value.enterpriseValue, dataset.currency) : "—"}</td><td>{result.ok ? amount(result.value.equityValue, dataset.currency) : "—"}</td><td>{result.ok ? `${number(result.value.intrinsicValuePerShare, 2)} ${dataset.currency}` : "—"}</td><td>{result.ok ? percent(result.value.upside) : "—"}</td><td>{result.ok ? percent(result.value.marginOfSafety) : "—"}</td><td className="fe-wrapped-cell">{result.ok ? result.warnings.join(" ") || (hasMock(dataset) ? "MOCK · Chỉ luyện tập" : "Nguồn chưa xác minh") : result.issues.join(" ")}</td></tr>)}</tbody></table></div><p className="fe-footnote">Chênh lệch / giá = (giá trị − giá tham chiếu) / giá tham chiếu. Biên an toàn = (giá trị − giá tham chiếu) / giá trị; chỉ tính khi mẫu số phù hợp.</p></Panel>
    <div className="fe-scenario-picker"><span>Chi tiết kịch bản</span>{scenarios.map((item) => <button key={item.name} aria-pressed={selected === item.name} onClick={() => setSelected(item.name)}>{item.name}</button>)}</div>
    {current.ok ? <DcfBreakdown output={current.value} currency={dataset.currency} /> : <p className="fe-empty fe-model-blocked"><Calculator size={20} aria-hidden="true" />Chưa có phân tích chi tiết DCF. Bổ sung các đầu vào và giả định được nêu trong bảng kết quả.</p>}
    {cells.length > 0 && <Panel title={`Độ nhạy · ${selected}`} subtitle={`Giá trị / cổ phiếu · ${dataset.currency} · Cùng hàm DCF với kết quả chính`} className="section-gap"><div className="table-scroll"><table><thead><tr><th>WACC / G DÀI HẠN</th>{growths.map((growth) => <th key={growth}>{percent(growth)}</th>)}</tr></thead><tbody>{waccs.map((wacc) => <tr key={wacc}><td>{percent(wacc)}</td>{growths.map((growth) => { const result = cells.find((cell) => cell.wacc === wacc && cell.growth === growth)!.result; return <td key={growth} title={result.ok ? result.warnings.join(" ") : result.issues.join(" ")}>{result.ok ? number(result.value.intrinsicValuePerShare, 2) : "—"}</td>; })}</tr>)}</tbody></table></div><p className="fe-footnote">Ô “—” không đủ điều kiện tính; mở tooltip để xem lý do. Tăng trưởng dài hạn phải nhỏ hơn WACC.</p></Panel>}
    <Panel title={`Định giá tương đối · ${selected}`} subtitle="Hệ số do bạn nhập · Đối chiếu phạm vi, kỳ và cơ sở cổ phiếu trước khi sử dụng" className="section-gap"><div className="table-scroll"><table><thead><tr><th>PHƯƠNG PHÁP</th><th>HỆ SỐ</th><th>GIÁ TRỊ / CỔ PHIẾU</th><th>BIÊN AN TOÀN</th><th>ĐIỀU KIỆN</th></tr></thead><tbody>{([{ method: "pe", label: "P/E", multiple: scenario.peMultiple }, { method: "pb", label: "P/B", multiple: scenario.pbMultiple }, { method: "evEbitda", label: "EV/EBITDA", multiple: scenario.evEbitdaMultiple }] as const).map((item) => { const result = evaluateRelative(dataset, reportId, item.method, item.multiple); return <tr key={item.method}><td>{item.label}</td><td>{item.multiple === null ? "—" : `${number(item.multiple, 2)}x`}</td><td>{result.ok ? `${number(result.value.intrinsicValuePerShare, 2)} ${dataset.currency}` : "—"}</td><td>{result.ok ? percent(result.value.marginOfSafety) : "—"}</td><td className="fe-wrapped-cell">{result.ok ? result.warnings.join(" ") || "Có điều kiện theo hệ số giả định" : result.issues.join(" ")}</td></tr>; })}</tbody></table></div></Panel>
    <PeerComparison dataset={dataset} reportId={reportId} onApply={(method, value, containsMock) => { const keys = { pe: "peMultiple", pb: "pbMultiple", evEbitda: "evEbitdaMultiple" } as const; setScenarios(scenarios.map((item) => item.name === selected ? { ...item, [keys[method]]: value } : item)); if (containsMock) setMockPeerApplied(true); }} />
    <p className="fe-footnote">Dữ liệu, giả định và nhóm so sánh là ba đầu vào riêng. Lưu giả định hoặc tải JSON để sử dụng lại; JSON dữ liệu tài chính không chứa giả định.</p>
  </>;
}

function SourceRegistry({ dataset }: { dataset: FinancialDataset }) {
  return <Panel title="Nguồn dữ liệu & giới hạn" subtitle="Có nguồn tham chiếu không đồng nghĩa nội dung đã được xác minh."><div className="fe-source-list">{dataset.sources.map((source) => <article key={source.id}><div><span className="fe-source-id">{source.id}</span><span className={`badge ${source.provenance === "mock" ? "mock-badge" : ""}`}>{source.provenance === "mock" ? "MOCK" : "CHƯA XÁC MINH"}</span></div><h3>{source.title}</h3><p>Ngày truy cập: {source.accessedAt || "chưa rõ"}</p>{source.url && <a href={source.url} target="_blank" rel="noopener noreferrer">Mở nguồn <ExternalLink size={12} aria-hidden="true" /></a>}</article>)}</div><p className="fe-footnote">Kết quả tính là phép biến đổi xác định từ số liệu đã nhập. Hệ thống không tự đối chiếu tài liệu gốc hoặc chứng nhận độ tin cậy của nguồn.</p></Panel>;
}

function EngineContent({ stock, view }: { stock: Stock; view: View }) {
  const state = useFinancialDataset(stock.symbol, industryFor(stock));
  const [selectedReport, setSelectedReport] = useState("");
  const dataset = state.dataset;
  const reportId = dataset?.reports.some((report) => report.id === selectedReport) ? selectedReport : dataset?.reports.slice().sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)?.id ?? "";
  return <div className="financial-engine"><div className="fe-intro"><div><p className="eyebrow">FINANCIAL ENGINE / LOCAL</p><h2>{view === "financials" ? "Từ báo cáo đến chỉ số có thể kiểm tra." : "Định giá theo dữ liệu và giả định minh bạch."}</h2><p>Tính toán xác định · Nguồn có thể đối chiếu · Không gọi AI hay API thị trường</p></div><span className="badge"><Database size={13} aria-hidden="true" /> CHỈ LƯU LOCAL</span></div><DatasetInput stock={stock} state={state} />
    {!dataset ? <div className="fe-onboarding"><Calculator size={28} aria-hidden="true" /><h3>Chưa có bộ dữ liệu hợp lệ cho {stock.symbol}</h3><p>Tải mẫu JSON, điền số liệu và nguồn rồi nhập lại. Có thể nạp MOCK để kiểm tra phương pháp; số liệu MOCK sẽ luôn được đánh dấu.</p><div><span>01 · Nhập dữ liệu</span><span>02 · Kiểm tra nguồn & kỳ</span><span>03 · Phân tích có điều kiện</span></div></div> : <><DatasetSummary dataset={dataset} reportId={reportId} onReport={setSelectedReport} />{dataset.industry !== "corporate" ? <div className="fe-sector-block" role="status"><h3>{industryNames[dataset.industry]} cần mô hình chuyên ngành</h3><p>Đã nhận và có thể lưu cấu trúc dữ liệu. Các tỷ số doanh nghiệp thông thường, FCFF–DCF và định giá tương đối đang khóa cho nhóm này. Không áp dụng máy móc EV/EBITDA, CFO − CAPEX hoặc hệ số thanh khoản doanh nghiệp.</p></div> : view === "financials" ? <><FinancialStatements dataset={dataset} reportId={reportId} /><HistoricalComparison dataset={dataset} /><RatioTable dataset={dataset} reportId={reportId} /></> : <ValuationAnalysis key={`${dataset.symbol}-${reportId}-${dataset.sources.map((source) => source.id).join("-")}`} dataset={dataset} reportId={reportId} />}<SourceRegistry dataset={dataset} /></>}
  </div>;
}

export function FinancialWorkspace({ stock, view, demo }: { stock: Stock; view: View; demo: ReactNode }) {
  const [showDemo, setShowDemo] = useState(false);
  return <><div className="fe-mode-tabs" aria-label="Chế độ dữ liệu"><button aria-pressed={!showDemo} onClick={() => setShowDemo(false)}><Calculator size={15} aria-hidden="true" />Financial Engine</button><button aria-pressed={showDemo} onClick={() => setShowDemo(true)}><FlaskConical size={15} aria-hidden="true" />Dữ liệu minh họa Phase 1</button></div>{showDemo ? demo : <EngineContent key={`${stock.symbol}-${view}`} stock={stock} view={view} />}</>;
}
