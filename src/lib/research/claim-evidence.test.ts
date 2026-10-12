import { describe, expect, it } from "vitest";
import { stocks } from "../data/mock-provider";
import data from "../financial/fixtures/stable.input.json";
import scenarios from "../financial/fixtures/stable.scenarios.json";
import { createResearchPacket, getResponseTemplate, validateImportedReport } from "./packet";

const packet = () => createResearchPacket(stocks[0], "Đối chiếu luận điểm và định giá", {
  sources: [{ title: "Synthetic source", url: "", publishedAt: "2026-04-01", period: "FY2025", locator: "page 1", content: "Doanh nghiệp có dữ liệu thử nghiệm. Đây không phải báo cáo doanh nghiệp thực." }],
  financial: { datasetJson: JSON.stringify({ ...data, symbol: stocks[0].symbol }), reportId: "FY2025", scenariosJson: JSON.stringify(scenarios) },
});
describe("research evidence matching", () => {
  it("accepts exact quotation but rejects invented quote and uncited source", () => {
    const p = packet(); const report = getResponseTemplate(p);
    report.sections[0].claims = [{ text: "Nguồn thử nghiệm chưa xác minh", category: "source_fact", sourceIds: ["D01"], quotes: [{ sourceId: "D01", text: "Đây không phải báo cáo doanh nghiệp thực." }] }];
    expect(validateImportedReport(JSON.stringify(report), p).ok).toBe(true);
    report.sections[0].claims[0].quotes![0].text = "Doanh nghiệp đảm bảo có lợi nhuận";
    expect(validateImportedReport(JSON.stringify(report), p).ok).toBe(false);
    report.sections[0].claims[0].quotes![0] = { sourceId: "D02", text: "Đây không phải báo cáo doanh nghiệp thực." };
    expect(validateImportedReport(JSON.stringify(report), p).ok).toBe(false);
  });
  it("keeps legacy source claims explicitly unverified when quotations are absent", () => {
    const p = packet(); const report = getResponseTemplate(p);
    report.sections[0].claims = [{ text: "Chưa đối chiếu nguồn", category: "source_fact", sourceIds: ["D01"] }];
    const result = validateImportedReport(JSON.stringify(report), p);
    expect(result.ok && result.warnings.some(w => w.includes("chưa kèm trích đoạn"))).toBe(true);
  });
  it("binds valuation numbers to scenario, currency and valuation date", () => {
    const p = packet(); const s = p.financialEvidence!.valuation.find(v => v.assumptions.name === "Base")!;
    if (!s.result.ok) throw Error("Expected valid fixture");
    const report = getResponseTemplate(p);
    report.sections[3].claims = [{ text: "EV giả định của bộ MOCK", category: "interpretation", sourceIds: ["E01"], valuationClaims: [{ scenario: "Base", field: "enterpriseValue", value: s.result.value.enterpriseValue, unit: "VND", valuationAsOf: s.result.value.provenance.valuationAsOf }] }];
    expect(validateImportedReport(JSON.stringify(report), p).ok).toBe(true);
    const claim = report.sections[3].claims[0].valuationClaims![0];
    claim.unit = "USD"; expect(validateImportedReport(JSON.stringify(report), p).ok).toBe(false);
    claim.unit = "VND"; claim.valuationAsOf = "2026-10-12";
    expect(validateImportedReport(JSON.stringify(report), p).ok).toBe(false);
    claim.valuationAsOf = s.result.value.provenance.valuationAsOf; claim.value += 1;
    expect(validateImportedReport(JSON.stringify(report), p).ok).toBe(false);
  });
  it("does not allow a blocked date comparison to become zero upside", () => {
    const altered = { ...data, symbol: stocks[0].symbol, market: { ...data.market, asOf: "2026-03-01" } };
    const p = createResearchPacket(stocks[0], "Kiểm tra ngày định giá", { financial: { datasetJson: JSON.stringify(altered), reportId: "FY2025", scenariosJson: JSON.stringify(scenarios) } });
    const s = p.financialEvidence!.valuation.find(v => v.assumptions.name === "Base")!;
    if (!s.result.ok) throw Error("Expected valid EV with locked comparison");
    expect(s.result.value.upside).toBeNull();
    const report = getResponseTemplate(p);
    report.sections[3].claims = [{ text: "Không được biến null thành zero", category: "interpretation", sourceIds: ["E01"], valuationClaims: [{ scenario: "Base", field: "upside", value: 0, unit: "fraction", valuationAsOf: s.result.value.provenance.valuationAsOf }] }];
    expect(validateImportedReport(JSON.stringify(report), p).ok).toBe(false);
  });
});
