export type DataKind =
  | "mock"
  | "verified"
  | "calculated"
  | "assumption"
  | "interpretation";
export interface Provenance {
  kind: DataKind;
  source: string;
  asOf: string;
}
export interface FinancialPeriod {
  year: number;
  revenue: number;
  netIncome: number;
  assets: number;
  equity: number;
  debt: number;
  cash: number;
  operatingCashFlow: number;
  capex: number;
}
export interface PricePoint {
  date: string;
  price: number;
  volume: number;
}
export interface Stock {
  symbol: string;
  name: string;
  exchange: "HOSE" | "HNX" | "UPCoM";
  sector: string;
  price: number;
  change: number;
  marketCap: number;
  pe: number | null;
  pb: number | null;
  roe: number;
  dividendYield: number;
  description: string;
  provenance: Provenance;
  prices: PricePoint[];
  financials: FinancialPeriod[];
}
/** Future licensed adapters must preserve provenance and return null for unavailable values. */
export interface EquityDataProvider {
  readonly id: string;
  searchStocks(query: string): Promise<Stock[]>;
  getStock(symbol: string): Promise<Stock | null>;
}
