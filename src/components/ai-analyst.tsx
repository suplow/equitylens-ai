"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, ClipboardCopy, Download, ExternalLink, FileCheck2, FileText, Info, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { Stock } from "@/lib/data/types";
import type { EvidenceInput, ImportResult, ResearchPacket, ResearchClaim } from "@/lib/research/types";
import { buildChatGPTPrompt, createResearchPacket, getResearchChecklist, getResponseTemplate, validateImportedReport } from "@/lib/research/packet";
import { Button } from "./ui/button";
import { Panel } from "./shared";
import "./research-workbench.css";
import { useFinancialDataset } from "@/hooks/use-financial-dataset";

const emptyEvidence: EvidenceInput = { title: "", url: "", publishedAt: "", period: "", locator: "", content: "" };
const claimLabels: Record<ResearchClaim["category"], string> = {
  source_fact: "Dữ kiện trích từ nguồn · Chưa xác minh",
  interpretation: "AI Interpretation · Diễn giải",
  assumption: "Analyst Assumption · Giả định",
  missing_data: "Dữ liệu còn thiếu",
};

function downloadText(filename: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EvidenceEditor({ onAdd, onChange, disabled }: {
  onAdd: (source: EvidenceInput) => boolean;
  onChange: (pending: boolean) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<EvidenceInput>(emptyEvidence);
  function update(field: keyof EvidenceInput, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    onChange(Object.values(next).some((text) => text.trim().length > 0));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (onAdd(draft)) { setDraft(emptyEvidence); onChange(false); }
  }
  return (
    <details className="rw-evidence-editor">
      <summary><Plus size={16} aria-hidden="true" /> Thêm tài liệu nguồn</summary>
      <form onSubmit={submit} className="rw-source-form">
        <p className="rw-help">Dán đúng đoạn cần nghiên cứu, kèm đơn vị tiền tệ và số trang. Có thể thêm tối đa 8 tài liệu.</p>
        <label className="rw-field">Tên tài liệu
          <input required minLength={2} maxLength={200} value={draft.title} onChange={(e) => update("title", e.target.value)} placeholder="Ví dụ: Báo cáo tài chính hợp nhất năm 2025" />
        </label>
        <label className="rw-field">Đường dẫn nguồn <span className="rw-optional">· Không bắt buộc</span>
          <input type="url" maxLength={2000} value={draft.url} onChange={(e) => update("url", e.target.value)} placeholder="https://..." />
        </label>
        <div className="rw-field-pair">
          <label className="rw-field">Ngày công bố <span className="rw-optional">· Nếu biết</span>
            <input type="date" value={draft.publishedAt} onChange={(e) => update("publishedAt", e.target.value)} />
          </label>
          <label className="rw-field">Kỳ báo cáo
            <input required minLength={2} maxLength={100} value={draft.period} onChange={(e) => update("period", e.target.value)} placeholder="Ví dụ: Năm 2025" />
          </label>
        </div>
        <label className="rw-field">Vị trí trích dẫn
          <input required minLength={2} maxLength={200} value={draft.locator} onChange={(e) => update("locator", e.target.value)} placeholder="Ví dụ: Trang 12, Thuyết minh số 8" />
        </label>
        <div className="rw-field"><label htmlFor="source-content">Nội dung trích từ tài liệu</label>
          <textarea id="source-content" required minLength={20} rows={6} maxLength={12000} value={draft.content} onChange={(e) => update("content", e.target.value)} placeholder="Dán nội dung cùng đơn vị và kỳ tương ứng. Nội dung này chưa được hệ thống xác minh." />
        </div>
        <div className="rw-transfer-actions"><Button type="submit" variant="outline" disabled={disabled}><Plus size={14} aria-hidden="true" /> {disabled ? "Đã đủ 8 tài liệu" : "Thêm vào hồ sơ"}</Button><Button type="button" variant="ghost" onClick={() => { setDraft(emptyEvidence); onChange(false); }}>Xóa bản nháp tài liệu</Button></div>
      </form>
    </details>
  );
}

function PacketSources({ packet }: { packet: ResearchPacket }) {
  return <div className="rw-sources">
    {packet.sources.length === 0 ? <p className="rw-empty">Chưa có tài liệu. ChatGPT chỉ có thể hướng dẫn bổ sung dữ liệu và phương pháp nghiên cứu.</p> : packet.sources.map((source) => <article className="rw-source" key={source.id}>
      <div className="rw-source-top"><span className="rw-source-id">{source.id}</span><span className={`badge ${source.status === "mock" ? "mock-badge" : ""}`}>{source.status === "mock" ? "MOCK" : "CHƯA XÁC MINH"}</span></div>
      <h3>{source.title}</h3><p className="rw-help">{source.publishedAt || "Chưa rõ ngày công bố"} · {source.period} · {source.locator}</p>
      {source.url && <a className="rw-source-link" href={source.url} target="_blank" rel="noopener noreferrer">Mở tài liệu nguồn <ExternalLink size={12} aria-hidden="true" /></a>}
      <details className="rw-source-excerpt"><summary>Xem nội dung đã đưa vào hồ sơ</summary><p>{source.content}</p></details>
    </article>)}
  </div>;
}

function ReviewResult({ result, packet }: { result: ImportResult; packet: ResearchPacket }) {
  if (!result.ok) return <div className="rw-validation rw-validation-error" role="alert"><strong>Chưa thể nhận báo cáo</strong><ul>{result.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>;
  return <div className="rw-reviewed-report">
    <div className="rw-validation" role="status">
      <div className="rw-validation-title"><FileCheck2 size={18} aria-hidden="true" /><strong>Đã kiểm tra cấu trúc và tham chiếu nguồn</strong></div>
      <p>AI Interpretation · Nội dung và số liệu chưa được xác minh đúng. Cần đọc lại tài liệu gốc trước khi sử dụng.</p>
      {result.warnings.length > 0 && <ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    </div>
    <div className="rw-report-heading"><h3>Báo cáo nhập · Chưa kiểm chứng</h3><Button variant="outline" size="sm" onClick={() => downloadText(`${packet.symbol}-research-result.json`, JSON.stringify({ packet, report: result.report, warnings: result.warnings }, null, 2), "application/json")}><Download size={14} aria-hidden="true" /> Tải hồ sơ & kết quả</Button></div>
    {packet.mode === "mock_practice" && <p className="rw-warning">MOCK · Báo cáo luyện tập, không phải kết luận về doanh nghiệp thực.</p>}
    <p className="rw-summary">{result.report.summary}</p>
    {result.report.sections.map((section) => <section className="rw-report-section" key={section.title}>
      <h3>{section.title}</h3>
      {section.claims.map((claim, index) => <article className="rw-claim" key={index}>
        <span className="rw-claim-kind">{claimLabels[claim.category]}</span><p>{claim.text}</p>
        {claim.financialClaims?.map((metric, i) => <p className="rw-help" key={i}>Đối chiếu E01: {metric.metricId} = {metric.value} ({metric.unit}; percent dùng phân số). Khớp số cấu trúc không xác minh câu diễn giải.</p>)}
        {claim.sourceIds.length > 0 && <div className="rw-citations">{claim.sourceIds.map((id) => {
          const source = packet.sources.find((item) => item.id === id);
          return <details key={id}><summary><FileText size={12} aria-hidden="true" />{id}</summary><p><strong>{source?.title}</strong><br />{source?.publishedAt || "Chưa rõ ngày công bố"} · {source?.period}<br />{source?.locator}</p><blockquote>{source?.content}</blockquote></details>;
        })}</div>}
      </article>)}
    </section>)}
    <div className="rw-limitations"><h3>Giới hạn của báo cáo</h3><ul>{result.report.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></div>
  </div>;
}

function ResearchWorkbench({ stock }: { stock: Stock }) {
  const financial = useFinancialDataset(stock.symbol, stock.sector === "Ngân hàng" ? "bank" : "corporate");
  const [attachFinancial, setAttachFinancial] = useState(false);
  const [reportId, setReportId] = useState("");
  const [scenariosJson, setScenariosJson] = useState("");
  const [question, setQuestion] = useState(`Cần những bằng chứng nào để đánh giá chất lượng lợi nhuận và rủi ro của ${stock.symbol}?`);
  const [assumptions, setAssumptions] = useState("");
  const [sources, setSources] = useState<EvidenceInput[]>([]);
  const [pendingSource, setPendingSource] = useState(false);
  const [includeMock, setIncludeMock] = useState(false);
  const [packet, setPacket] = useState<ResearchPacket | null>(null);
  const [step, setStep] = useState(0);
  const [rawReport, setRawReport] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(0);
  const prompt = packet ? buildChatGPTPrompt(packet) : "";

  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      contentRef.current?.focus({ preventScroll: true });
      contentRef.current?.scrollIntoView({ block: "start" });
    }
  }, [step]);

  function invalidate() {
    if (packet) setFeedback("Hồ sơ đã thay đổi. Hãy tạo lại hồ sơ trước khi chuyển sang ChatGPT.");
    setPacket(null); setResult(null); setRawReport(""); setError("");
  }
  function addEvidence(source: EvidenceInput) {
    try {
      createResearchPacket(stock, question, { sources: [...sources, source], assumptions, includeMock });
      invalidate(); setSources([...sources, { ...source }]); setFeedback("Đã thêm tài liệu. Nguồn do bạn cung cấp vẫn ở trạng thái chưa xác minh.");
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể thêm tài liệu."); return false; }
  }
  function preparePacket() {
    try {
      if (attachFinancial && !financial.dataset) throw Error("Nạp bộ dữ liệu đã lưu ở Financial Analysis trước khi đính kèm.");
      const next = createResearchPacket(stock, question, { sources, assumptions, includeMock, ...(attachFinancial ? { financial: { datasetJson: financial.raw, reportId, scenariosJson } } : {}) });
      setPacket(next); setResult(null); setRawReport(""); setError(""); setFeedback("Đã tạo hồ sơ. Xem nội dung trước khi chuyển sang ChatGPT."); setStep(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo hồ sơ."); }
  }
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setFeedback("Đã sao chép hồ sơ và hướng dẫn. Mở ChatGPT, dán vào cuộc trò chuyện rồi gửi."); }
    catch { setFeedback("Trình duyệt chưa cho phép sao chép. Bạn có thể tải hồ sơ .txt hoặc sao chép trong phần xem trước."); }
  }
  const steps = ["Chuẩn bị hồ sơ", "Chuyển sang ChatGPT", "Kiểm tra báo cáo"];
  return <div className="research-workbench">
    <div className="rw-intro"><div><p className="eyebrow">RESEARCH WORKBENCH</p><h2>Nghiên cứu có nguồn. Giữ quyền kiểm chứng.</h2><p>Web chạy local · ChatGPT xử lý trực tuyến · Chuyển hồ sơ thủ công</p></div><span className="badge"><ShieldCheck size={13} aria-hidden="true" /> KHÔNG CẦN API KEY</span></div>
    <nav className="rw-steps" aria-label="Quy trình nghiên cứu">{steps.map((label, index) => <button key={label} aria-current={step === index ? "step" : undefined} disabled={index > 0 && !packet} onClick={() => { setStep(index); setError(""); setFeedback(""); }}><span>{index < step ? <Check size={14} aria-hidden="true" /> : `0${index + 1}`}</span>{label}</button>)}</nav>
    {feedback && <p className="rw-feedback" role="status">{feedback}</p>}{error && <p className="rw-error" role="alert">{error}</p>}
    <div className="rw-layout"><div className="rw-main" ref={contentRef} tabIndex={-1} role="region" aria-label={steps[step]}>
      {step === 0 && <Panel title={`01 · Hồ sơ nghiên cứu ${stock.symbol}`} subtitle="Xác định câu hỏi và những gì AI được phép sử dụng."><div className="rw-panel-body">
        <div className="rw-field"><label htmlFor="analyst-question">Câu hỏi cho AI Analyst</label><textarea id="analyst-question" rows={3} maxLength={4000} value={question} onChange={(e) => { setQuestion(e.target.value); invalidate(); }} /></div>
        <div className="rw-prompt-suggestions">{[`Chất lượng lợi nhuận của ${stock.symbol} cần kiểm tra những gì?`, `Những dữ liệu nào còn thiếu để định giá ${stock.symbol}?`, "Giải thích ROE và giới hạn khi sử dụng chỉ số này."].map((text) => <button key={text} onClick={() => { setQuestion(text); invalidate(); }}>{text}<ArrowRight size={12} aria-hidden="true" /></button>)}</div>
        <div className="rw-field"><label htmlFor="analyst-assumptions">Giả định của người phân tích <span className="rw-optional">· Không bắt buộc</span></label><textarea id="analyst-assumptions" rows={2} maxLength={2000} value={assumptions} onChange={(e) => { setAssumptions(e.target.value); invalidate(); }} placeholder="Ví dụ: Khung nghiên cứu 3–5 năm. Mọi giả định cần được kiểm tra lại." /></div>
        <div className="rw-section-label"><h3>Tài liệu nguồn</h3><span className="badge">{sources.length} TÀI LIỆU</span></div>
        {sources.length === 0 ? <p className="rw-empty">Chưa có tài liệu. Thêm báo cáo tài chính, thuyết minh hoặc công bố doanh nghiệp để bắt đầu nghiên cứu có dẫn nguồn.</p> : <ul className="rw-evidence-list">{sources.map((source, index) => <li key={index}><FileText size={16} aria-hidden="true" /><div><strong>{source.title}</strong><p>{source.publishedAt || "Chưa rõ ngày công bố"} · {source.period} · Chưa xác minh</p></div><Button variant="ghost" size="icon" aria-label={`Xóa tài liệu ${source.title}`} onClick={() => { setSources(sources.filter((_, i) => i !== index)); invalidate(); }}><Trash2 size={15} aria-hidden="true" /></Button></li>)}</ul>}
        <EvidenceEditor onAdd={addEvidence} onChange={(pending) => { setPendingSource(pending); invalidate(); }} disabled={sources.length >= 8} />
        {pendingSource && <p className="rw-warning" role="status">Bạn đang nhập tài liệu. Bấm “Thêm vào hồ sơ” hoặc “Xóa bản nháp tài liệu” trước khi tạo hồ sơ.</p>}
        <details className="rw-evidence-editor"><summary>Đính kèm Financial Engine</summary>
          <p className="rw-help">Lưu bộ JSON ở Financial Analysis rồi nạp tại đây. Kết quả được tính lại từ dữ liệu đã kiểm tra; nguồn vẫn chưa xác minh. Không tự gửi lên ChatGPT.</p>
          <Button variant="outline" onClick={() => { invalidate(); financial.load(); setReportId(""); }}>Nạp dữ liệu tài chính đã lưu</Button>
          {financial.message && <p role="status">{financial.message}</p>}{financial.issues.map(issue => <p role="alert" key={issue}>{issue}</p>)}
          <label className="rw-field">Kỳ Financial Engine<select value={reportId} onChange={e => { invalidate(); setReportId(e.target.value); }}><option value="">Chọn kỳ báo cáo</option>{financial.dataset?.reports.map(r => <option key={r.id} value={r.id}>{r.id} · {r.kind} · {r.scope}</option>)}</select></label>
          <label className="rw-field">Giả định Bear/Base/Bull JSON · tùy chọn<textarea rows={3} maxLength={20000} value={scenariosJson} onChange={e => { invalidate(); setScenariosJson(e.target.value); }} placeholder="Dán mảng 3 kịch bản; bỏ trống để không xuất định giá." /></label>
          <label className="rw-mock-option"><input type="checkbox" checked={attachFinancial} onChange={e => { invalidate(); setAttachFinancial(e.target.checked); }} />Đưa kết quả Financial Engine vào hồ sơ</label>
        </details>
        <label className="rw-mock-option"><input type="checkbox" checked={includeMock} onChange={(e) => { setIncludeMock(e.target.checked); invalidate(); }} /><span><strong>Thêm dữ liệu MOCK để luyện tập</strong><small>Dữ liệu minh họa từ dashboard. Toàn bộ hồ sơ sẽ được đánh dấu MOCK; không dùng để kết luận đầu tư.</small></span></label>
        <div className="rw-actions"><p className="rw-help">Dữ liệu minh họa mặc định được loại khỏi hồ sơ.</p><Button onClick={preparePacket} disabled={question.trim().length < 5 || pendingSource}>Tạo hồ sơ nghiên cứu <ArrowRight size={15} aria-hidden="true" /></Button></div>
      </div></Panel>}
      {step === 1 && packet && <Panel title="02 · Chuyển hồ sơ sang ChatGPT" subtitle="Dùng tài khoản ChatGPT hiện tại của bạn."><div className="rw-panel-body">
        <div className="rw-packet-meta"><FileCheck2 size={20} aria-hidden="true" /><div><strong>Hồ sơ {packet.symbol}</strong><code>{packet.id}</code></div><span className={`badge ${packet.mode === "mock_practice" ? "mock-badge" : ""}`}>{packet.mode === "mock_practice" ? "MOCK · LUYỆN TẬP" : "NGUỒN DO BẠN CUNG CẤP"}</span></div>
        <ol className="rw-instructions"><li>Sao chép hướng dẫn cùng hồ sơ bên dưới.</li><li>Mở ChatGPT, dán nội dung và tự gửi yêu cầu.</li><li>Sao chép JSON ChatGPT trả về để kiểm tra ở bước 3.</li></ol>
        <div className="rw-transfer-actions"><Button onClick={copyPrompt}><ClipboardCopy size={15} aria-hidden="true" /> Sao chép hồ sơ + prompt</Button><Button variant="outline" onClick={() => downloadText(`${packet.symbol}-research-packet.txt`, prompt)}><Download size={15} aria-hidden="true" /> Tải hồ sơ .txt</Button><Button asChild variant="outline"><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Mở ChatGPT <ExternalLink size={14} aria-hidden="true" /></a></Button></div>
        <p className="rw-help rw-transfer-note">Website không tự gửi tài liệu. Nội dung sẽ được chuyển tới ChatGPT khi bạn dán và gửi trong cuộc trò chuyện.</p>
        <details className="rw-prompt-preview"><summary>Xem toàn bộ hồ sơ và hướng dẫn</summary><label className="sr-only" htmlFor="research-prompt">Hồ sơ và prompt gửi ChatGPT</label><textarea id="research-prompt" readOnly value={prompt} rows={14} /></details>
        <div className="rw-section-label"><h3>Nguồn trong hồ sơ</h3><span className="badge">{packet.sources.length} NGUỒN</span></div><PacketSources packet={packet} />
        {packet.financialEvidence && <details className="rw-evidence-editor"><summary>Kết quả tính toán và chất lượng dữ liệu</summary>
          <p>CALCULATED · {packet.financialEvidence.report.id} · {packet.financialEvidence.report.scope} · {packet.financialEvidence.currency}. Nguồn chưa được xác minh. Percent dùng phân số: 0.4 = 40%.</p>
          <ul>{packet.financialEvidence.quality.issues.slice(0, 10).map((issue, i) => <li key={i}>{issue.severity}: {issue.message}</li>)}</ul>
          {packet.financialEvidence.ratios.map(r => <details key={r.id}><summary>{r.label}: {r.result.ok ? `${r.result.value} ${r.unit}` : `Khóa · ${r.result.code}`}</summary><p>{r.formula}</p><p>{r.result.ok ? r.limitations : r.result.issues.join(" ")}</p><pre>{JSON.stringify(r.inputs, null, 2)}</pre></details>)}
          <p>{packet.financialEvidence.valuation.length} kịch bản định giá đính kèm. Giả định, ngày định giá, cảnh báo và trạng thái khóa nằm trong E01; không phải dự báo giá.</p>
        </details>}
        <div className="rw-actions"><Button variant="ghost" onClick={() => setStep(0)}>Sửa hồ sơ</Button><Button onClick={() => { setStep(2); setFeedback(""); }}>Tôi đã có phản hồi <ArrowRight size={15} aria-hidden="true" /></Button></div>
      </div></Panel>}
      {step === 2 && packet && <Panel title="03 · Kiểm tra báo cáo từ ChatGPT" subtitle="Đối chiếu định dạng, mã hồ sơ và mã nguồn trích dẫn."><div className="rw-panel-body">
        <div className="rw-import-note"><Info size={17} aria-hidden="true" /><p>Dán JSON do ChatGPT trả về cho hồ sơ <strong>{packet.symbol}</strong>. Kiểm tra tự động không thay thế việc xác minh số liệu và nội dung tài liệu.</p></div>
        <div className="rw-field"><label htmlFor="research-response">Phản hồi JSON từ ChatGPT</label><textarea id="research-response" className="rw-json-input" rows={10} maxLength={120000} value={rawReport} onChange={(e) => { setRawReport(e.target.value); setResult(null); }} placeholder={'{\n  "packetId": "...",\n  "symbol": "' + packet.symbol + '",\n  ...\n}'} spellCheck={false} /></div>
        <div className="rw-transfer-actions"><Button disabled={!rawReport.trim()} onClick={() => { setResult(validateImportedReport(rawReport, packet)); setFeedback(""); }}><FileCheck2 size={15} aria-hidden="true" /> Kiểm tra báo cáo</Button><Button variant="outline" onClick={() => downloadText(`${packet.symbol}-EMPTY-response-template.json`, JSON.stringify(getResponseTemplate(packet), null, 2), "application/json")}><Download size={14} aria-hidden="true" /> Tải mẫu JSON trống</Button></div>
        <p className="rw-help rw-transfer-note">BẢN MẪU TRỐNG chỉ hướng dẫn định dạng, không phải báo cáo AI.</p>
        {result && <ReviewResult result={result} packet={packet} />}
      </div></Panel>}
    </div><aside className="rw-sidebar" aria-label="Chất lượng hồ sơ nghiên cứu"><Panel title="Chất lượng hồ sơ" subtitle="Độ đầy đủ không đồng nghĩa với độ đúng.">
      <div className="rw-quality-status"><span className="rw-status-dot" /><strong>{includeMock ? "Hồ sơ luyện tập · MOCK" : "Chưa có dữ liệu được xác minh"}</strong><p>{sources.length} tài liệu do bạn cung cấp · {includeMock ? "Có dữ liệu minh họa" : "Không kèm dữ liệu minh họa"}</p></div>
      <div className="rw-sidebar-body"><h3>Cần kiểm tra trước khi kết luận</h3><ul className="rw-checklist">{(packet?.checklist ?? getResearchChecklist(stock)).map((item, index) => <li key={index}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ul></div>
      {packet && packet.missingData.length > 0 && <div className="rw-sidebar-body rw-gaps"><h3>Dữ liệu còn thiếu / chưa xác nhận</h3><ul>{packet.missingData.map((gap, index) => <li key={index}>{gap}</li>)}</ul></div>}
      <div className="rw-sidebar-body rw-data-legend"><h3>Bốn lớp thông tin</h3><dl><dt>Verified Data</dt><dd>Chưa có dữ liệu được hệ thống xác minh.</dd><dt>Calculated Metrics</dt><dd>Chưa có engine tính toán trong quy trình này.</dd><dt>Analyst Assumptions</dt><dd>Giả định được nhập riêng, cần kiểm tra.</dd><dt>AI Interpretation</dt><dd>Phản hồi từ ChatGPT, luôn cần đối chiếu.</dd></dl></div>
      <p className="rw-session-note">Hồ sơ chỉ được giữ trong phiên trang. Tải tệp để lưu trước khi tải lại hoặc chuyển mã cổ phiếu.</p>
    </Panel></aside></div>
  </div>;
}

export function AiAnalyst({ stock }: { stock: Stock }) {
  return <ResearchWorkbench key={stock.symbol} stock={stock} />;
}
