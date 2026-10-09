export const REPORT_SECTIONS = [
  "Executive Summary", "Business Overview", "Financial Performance", "Valuation",
  "Investment Thesis", "Key Risks", "Bull / Bear Case",
] as const;
export type ResearchMode = "provided_only" | "mock_practice";
export interface EvidenceInput {
  title: string;
  url: string;
  publishedAt: string;
  period: string;
  locator: string;
  content: string;
}
export interface ResearchSource extends EvidenceInput {
  id: string;
  status: "provided_unverified" | "mock";
}
export interface ResearchPacket {
  version: "1.0";
  id: string;
  symbol: string;
  company: string;
  industryTemplate: "corporate" | "bank";
  mode: ResearchMode;
  question: string;
  assumptions: string;
  sources: ResearchSource[];
  missingData: string[];
  checklist: string[];
}
export interface ResearchOptions {
  sources?: EvidenceInput[];
  assumptions?: string;
  includeMock?: boolean;
}
export interface ResearchClaim {
  text: string;
  category: "source_fact" | "interpretation" | "assumption" | "missing_data";
  sourceIds: string[];
}
export interface ImportedResearchReport {
  packetId: string;
  symbol: string;
  mode: ResearchMode;
  summary: string;
  sections: { title: (typeof REPORT_SECTIONS)[number]; claims: ResearchClaim[] }[];
  limitations: string[];
}
export type ImportResult =
  | { ok: true; report: ImportedResearchReport; warnings: string[] }
  | { ok: false; issues: string[] };
