import type {
  EquityDataProvider,
  FinancialPeriod,
  PricePoint,
  Stock,
} from "./types";

export const mockProvenance = {
  kind: "mock",
  source: "EquityLens · Bộ dữ liệu minh họa v1",
  asOf: "2026-09-30T08:00:00Z",
} as const;
export const sourceNote =
  "MOCK DATA · Số liệu giả lập, không phải dữ liệu thị trường · Mốc minh họa: 30/09/2026";
function history(price: number): PricePoint[] {
  return Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 6, 3 + i)).toISOString().slice(0, 10),
    price: Math.round(
      price *
        (0.86 +
          i * 0.0015 +
          Math.sin(i * 0.55) * 0.017 +
          Math.cos(i * 0.19) * 0.025),
    ),
    volume: 1200000 + ((i * 7919) % 29) * 83000,
  })).map((point, i) => (i === 89 ? { ...point, price } : point));
}
function financials(scale: number): FinancialPeriod[] {
  return [2022, 2023, 2024, 2025].map((year, i) => ({
    year,
    revenue: Math.round(scale * (1 + i * 0.17)),
    netIncome: Math.round(scale * (0.13 + i * 0.026)),
    assets: Math.round(scale * (1.3 + i * 0.21)),
    equity: Math.round(scale * (0.62 + i * 0.12)),
    debt: Math.round(scale * (0.24 + i * 0.025)),
    cash: Math.round(scale * (0.17 + i * 0.033)),
    operatingCashFlow: Math.round(scale * (0.16 + i * 0.023)),
    capex: Math.round(scale * (0.06 + i * 0.007)),
  }));
}
const seeds = [
  [
    "FPT",
    "Công ty Cổ phần FPT",
    "Công nghệ",
    128600,
    1.82,
    189300,
    23.4,
    5.2,
    24.8,
    1.6,
    42000,
  ],
  [
    "VNM",
    "Công ty Cổ phần Sữa Việt Nam",
    "Tiêu dùng",
    68400,
    -0.58,
    142900,
    15.8,
    3.6,
    22.4,
    5.4,
    58000,
  ],
  [
    "HPG",
    "Tập đoàn Hòa Phát",
    "Vật liệu",
    26850,
    1.13,
    171700,
    14.2,
    1.5,
    10.6,
    0,
    112000,
  ],
  [
    "VCB",
    "Ngân hàng TMCP Ngoại thương Việt Nam",
    "Ngân hàng",
    91200,
    0.88,
    509700,
    16.2,
    2.8,
    18.5,
    1.2,
    67000,
  ],
  [
    "MBB",
    "Ngân hàng TMCP Quân đội",
    "Ngân hàng",
    24500,
    -0.41,
    149600,
    6.8,
    1.3,
    21.7,
    2.0,
    44000,
  ],
  [
    "REE",
    "Công ty Cổ phần Cơ Điện Lạnh",
    "Tiện ích",
    67200,
    0.75,
    31600,
    12.6,
    1.6,
    13.1,
    1.5,
    9200,
  ],
] as const;
export const stocks: Stock[] = seeds.map(
  ([
    symbol,
    name,
    sector,
    price,
    change,
    marketCap,
    pe,
    pb,
    roe,
    dividendYield,
    scale,
  ]) => ({
    symbol,
    name,
    sector,
    exchange: "HOSE",
    price,
    change,
    marketCap,
    pe,
    pb,
    roe,
    dividendYield,
    description: `Hồ sơ minh họa cho ${name}, thuộc nhóm ${sector.toLowerCase()}. Thông tin trong bản demo dùng để khám phá giao diện nghiên cứu, chưa được đối chiếu với công bố của doanh nghiệp.`,
    provenance: mockProvenance,
    prices: history(price),
    financials: financials(scale),
  }),
);
export const marketIndices = [
  {
    symbol: "VN-INDEX",
    name: "HOSE",
    value: 1287.94,
    change: 0.84,
    points: 10.73,
  },
  {
    symbol: "VN30",
    name: "30 cổ phiếu vốn hóa lớn",
    value: 1346.28,
    change: 1.12,
    points: 14.91,
  },
  {
    symbol: "HNX-INDEX",
    name: "HNX",
    value: 235.61,
    change: -0.32,
    points: -0.76,
  },
  {
    symbol: "UPCOM-INDEX",
    name: "UPCoM",
    value: 93.42,
    change: 0.46,
    points: 0.43,
  },
];
export const marketHistory = history(1287.94);
export const mockProvider: EquityDataProvider = {
  id: "mock-v1",
  async searchStocks(query) {
    const text = query.trim().toLocaleLowerCase("vi");
    return stocks.filter((s) =>
      `${s.symbol} ${s.name}`.toLocaleLowerCase("vi").includes(text),
    );
  },
  async getStock(symbol) {
    return stocks.find((s) => s.symbol === symbol.toUpperCase()) ?? null;
  },
};
