import Link from "next/link";
import { Building2 } from "lucide-react";
import type { Stock } from "@/lib/data/types";
import { number } from "@/lib/format";
import { Change, MockBadge, Panel, SourceNote } from "./shared";
import { PriceChart } from "./price-chart";
import { Button } from "./ui/button";
export function StockOverview({ stock }: { stock: Stock }) {
  return (
    <>
      <div className="metric-grid">
        {[
          {
            label: "Giá minh họa",
            value: `${number(stock.price)} ₫`,
            detail: "MOCK · Giá chưa điều chỉnh",
          },
          {
            label: "Vốn hóa",
            value: number(stock.marketCap),
            detail: "Tỷ VND · Số liệu mock",
          },
          {
            label: "P/E",
            value: stock.pe ? `${number(stock.pe, 1)}x` : "—",
            detail: "Mock · Chưa tính từ báo cáo",
          },
          {
            label: "ROE",
            value: `${number(stock.roe, 1)}%`,
            detail: "Mock · Chưa tính từ báo cáo",
          },
        ].map((m) => (
          <div className="metric" key={m.label}>
            <p className="metric-label">{m.label}</p>
            <p className="metric-value">{m.value}</p>
            <p className="metric-detail">{m.detail}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Lịch sử giá"
          subtitle={`${stock.symbol} · Giá minh họa (VND)`}
          action={<MockBadge />}
          className="chart-panel"
        >
          <div className="chart-metric">
            <strong>{number(stock.price)}</strong>
            <Change value={stock.change} />
          </div>
          <PriceChart data={stock.prices} label={stock.symbol} />
          <SourceNote />
        </Panel>
        <Panel
          title="Hồ sơ doanh nghiệp"
          action={<Building2 size={17} className="muted" />}
        >
          <p className="body-copy">{stock.description}</p>
          <dl className="info-list">
            <div>
              <dt>Sàn niêm yết</dt>
              <dd>{stock.exchange}</dd>
            </div>
            <div>
              <dt>Ngành</dt>
              <dd>{stock.sector}</dd>
            </div>
            <div>
              <dt>P/B (mock)</dt>
              <dd>{number(stock.pb ?? 0, 1)}x</dd>
            </div>
            <div>
              <dt>Lợi suất cổ tức (mock)</dt>
              <dd>{number(stock.dividendYield, 1)}%</dd>
            </div>
          </dl>
          <SourceNote />
        </Panel>
      </div>
      <Panel
        title="Ngành & doanh nghiệp so sánh"
        subtitle="Comparable company analysis"
        action={<span className="badge">CHƯA CÓ DỮ LIỆU</span>}
      >
        <p className="body-copy">
          Chưa có bộ doanh nghiệp cùng ngành được xác minh cho {stock.symbol}.
          Việc lựa chọn đối thủ so sánh sẽ xét mô hình kinh doanh, quy mô và kỳ
          báo cáo tương đồng.
        </p>
        <div className="body-copy">
          <Button asChild variant="outline">
            <Link href={`/financials/${stock.symbol}`}>
              Xem báo cáo tài chính mẫu
            </Link>
          </Button>
        </div>
      </Panel>
    </>
  );
}
