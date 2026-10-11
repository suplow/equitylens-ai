export type Industry = "corporate" | "bank" | "securities" | "insurance";
export type Currency = "VND" | "USD" | "EUR";
export type Unit = "unit" | "thousand" | "million" | "billion";
export type IssueCode = "missing_data" | "not_meaningful" | "incompatible" | "unsupported" | "invalid";
export type Calculation<T> = { ok: true; value: T; warnings: string[] } | { ok: false; value: null; code: IssueCode; issues: string[]; warnings: string[] };
export interface FinancialSource { id: string; title: string; url: string; accessedAt: string; provenance: "user_supplied" | "mock" }
export interface Fact { value: number | null; unit: Unit; sourceId: string; locator: string }
export interface PeriodMetadata {
  id: string; kind: "annual" | "quarter" | "ytd"; fiscalYear: number; fiscalQuarter: 1 | 2 | 3 | 4 | null;
  startDate: string; endDate: string; scope: "consolidated" | "standalone";
  audited: "audited" | "reviewed" | "unaudited" | "unknown"; publishedAt: string;
  /** Same accounting/restatement and share-adjustment basis across comparable periods. */
  basis: string;
  openingReportId?: string;
  restatement?: { status: "original" | "restated"; revision: string; note: string };
}
export const INCOME_FIELDS = ["revenue", "costOfRevenue", "grossProfit", "operatingExpenses", "ebit", "interestExpense", "pretaxIncome", "incomeTax", "netIncome", "netIncomeToCommon", "dilutedEps", "depreciation"] as const;
export const BALANCE_FIELDS = ["cash", "receivables", "inventory", "currentAssets", "totalAssets", "currentLiabilities", "shortTermDebt", "longTermDebt", "totalLiabilities", "shareholdersEquity", "minorityInterest", "preferredEquity", "nonOperatingAssets", "otherClaims", "operatingWorkingCapital"] as const;
export const CASH_FIELDS = ["cfo", "capex", "cfi", "cff"] as const;
export const CORPORATE_FIELDS = [...INCOME_FIELDS, ...BALANCE_FIELDS, ...CASH_FIELDS] as const;
export type CorporateField = typeof CORPORATE_FIELDS[number];
export interface CorporateReport extends PeriodMetadata {
  fields: Record<CorporateField, Fact>;
  /** Internal calculated report only; the JSON input schema rejects this field. */
  derived?: { method: string; inputs: InputEvidence[]; reportIds: string[] };
}
export interface BankReport extends PeriodMetadata { bank: { netInterestIncome: Fact; grossLoans: Fact; nonPerformingLoans: Fact; regulatoryCapital: Fact; riskWeightedAssets: Fact } }
export interface SecuritiesReport extends PeriodMetadata { securities: { brokerageRevenue: Fact; tradingAssets: Fact; clientMoney: Fact } }
export interface InsuranceReport extends PeriodMetadata { insurance: { insuranceRevenue: Fact; claimsExpense: Fact; insuranceLiabilities: Fact } }
export interface MarketSnapshot {
  asOf: string; price: Fact; sharesOutstanding: Fact;
  sharesAsOf?: string;
  /** Explicit confirmation that price/share data and reported per-share figures use the same corporate-action basis. */
  basis: string;
}
export interface DatasetBase {
  version: "2.0"; symbol: string; name: string; currency: Currency; fiscalYearEndMonth: number;
  sources: FinancialSource[]; market: MarketSnapshot | null;
  analysisAsOf?: string;
  corporateActions?: { reviewedFrom: string; reviewedThrough: string; sourceId: string; events: { date: string; kind: "split" | "issuance" | "buyback" | "other" }[] };
}
export type CorporateDataset = DatasetBase & { industry: "corporate"; reports: CorporateReport[] };
export type FinancialDataset = CorporateDataset
  | (DatasetBase & { industry: "bank"; reports: BankReport[] })
  | (DatasetBase & { industry: "securities"; reports: SecuritiesReport[] })
  | (DatasetBase & { industry: "insurance"; reports: InsuranceReport[] });
export interface NormalizedReport extends PeriodMetadata {
  values: Record<CorporateField, number | null>; facts: Record<CorporateField, Fact>;
  /** Derived flow values retain both source facts; facts alone refer to the current YTD. */
  derivation?: { method: "ytd_difference"; inputs: InputEvidence[] };
}
export interface InputEvidence { key: string; value: number | null; sourceId: string; locator: string; periodId: string }
export interface RatioResult {
  id: string; label: string; group: string; unit: "percent" | "times" | "days" | "money";
  formula: string; meaning: string; limitations: string;
  result: Calculation<number>; inputs: InputEvidence[];
  provenance: { kind: "calculated"; containsMock: boolean; sourceIds: string[] };
}
