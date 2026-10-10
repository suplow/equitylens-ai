import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { mockProvider, stocks } from "@/lib/data/mock-provider";
import { StockOverview } from "@/components/stock-overview";
import { FinancialAnalysis } from "@/components/financial-analysis";
import { Valuation } from "@/components/valuation";
import { AiAnalyst } from "@/components/ai-analyst";
import { ResearchReport } from "@/components/research-report";
import { WatchButton } from "@/components/watchlist";
import { MockBadge } from "@/components/shared";
const sections = [
  { path: "stocks", title: "Tổng quan" },
  { path: "financials", title: "Tài chính" },
  { path: "valuation", title: "Định giá" },
  { path: "analyst", title: "AI Analyst" },
  { path: "reports", title: "Báo cáo" },
];
const paramsSchema = z.object({
  section: z.enum(["stocks", "financials", "valuation", "analyst", "reports"]),
  symbol: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((s) => s.toUpperCase()),
});
export function generateStaticParams() {
  return sections.flatMap((section) =>
    stocks.map((stock) => ({ section: section.path, symbol: stock.symbol })),
  );
}
export default async function StockPage({
  params,
}: {
  params: Promise<{ section: string; symbol: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { section, symbol } = parsed.data;
  const stock = await mockProvider.getStock(symbol);
  if (!stock) notFound();
  return (
    <>
      <div className="page-heading">
        <div className="stock-header">
          <span className="ticker-icon">{stock.symbol}</span>
          <div>
            <p className="eyebrow">
              EQUITY RESEARCH /{" "}
              {sections.find((s) => s.path === section)?.title}
            </p>
            <h1>
              {stock.symbol}
              {section === "analyst" ? <span className="badge">HỒ SƠ LOCAL</span> : <MockBadge />}
            </h1>
            <p className="stock-meta">
              {stock.name}
              <span>· {stock.exchange}</span>
            </p>
          </div>
        </div>
        <WatchButton symbol={stock.symbol} />
      </div>
      <nav className="stock-tabs" aria-label="Các mục phân tích cổ phiếu">
        {sections.map((s) => (
          <Link
            key={s.path}
            href={`/${s.path}/${stock.symbol}`}
            aria-current={section === s.path ? "page" : undefined}
          >
            {s.title}
          </Link>
        ))}
      </nav>
      {section === "stocks" ? (
        <StockOverview stock={stock} />
      ) : section === "financials" ? (
        <FinancialAnalysis stock={stock} />
      ) : section === "valuation" ? (
        <Valuation stock={stock} />
      ) : section === "analyst" ? (
        <AiAnalyst stock={stock} />
      ) : (
        <ResearchReport stock={stock} />
      )}
    </>
  );
}
