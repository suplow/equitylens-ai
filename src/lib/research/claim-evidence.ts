import type { ResearchClaim, ResearchPacket } from "./types";

/** Matches only supplied evidence, never authenticates a document or the meaning of prose. */
export function checkClaimEvidence(claim: ResearchClaim, packet: ResearchPacket): string[] {
  const issues: string[] = [];
  for (const quote of claim.quotes ?? []) {
    const source = packet.sources.find(s => s.id === quote.sourceId);
    if (!claim.sourceIds.includes(quote.sourceId) || !source || quote.sourceId === "E01" || !source.content.includes(quote.text)) {
      issues.push(`Trích đoạn ${quote.sourceId} không khớp nguyên văn nguồn đã dẫn.`);
    }
  }
  for (const cited of claim.valuationClaims ?? []) {
    const scenario = packet.financialEvidence?.valuation.find(s => s.assumptions.name === cited.scenario);
    if (!claim.sourceIds.includes("E01") || !scenario?.result.ok) { issues.push("Định giá cần E01 và kịch bản khả dụng."); continue; }
    const output = scenario.result.value;
    const unit = ["upside", "marginOfSafety"].includes(cited.field) ? "fraction" : cited.field === "intrinsicValuePerShare" ? `${output.provenance.currency}/share` : output.provenance.currency;
    if (output[cited.field] === null || output[cited.field] !== cited.value || cited.unit !== unit || cited.valuationAsOf !== output.provenance.valuationAsOf) {
      issues.push(`Định giá ${cited.scenario}.${cited.field} sai số, đơn vị, ngày hoặc bị khóa.`);
    }
  }
  return issues;
}
