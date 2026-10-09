import Link from "next/link";
import {
  CalendarDays,
  Sparkles,
  FileSearch,
  ShieldCheck,
  Scale,
  TriangleAlert,
  FileText,
  Info,
} from "lucide-react";
import { marketHistory, marketIndices } from "@/lib/data/mock-provider";
import { number } from "@/lib/format";
import { Button } from "./ui/button";
import { Change, MockBadge, PageHeading, Panel, SourceNote } from "./shared";
import { PriceChart, Sparkline } from "./price-chart";
import { Watchlist } from "./watchlist";
export function Dashboard() {
  return (
    <>
      <PageHeading
        eyebrow="THỊ TRƯỜNG VIỆT NAM"
        title="Góc nhìn thị trường"
        description="Theo dõi doanh nghiệp. Hiểu giá trị. Đầu tư có cơ sở."
        action={
          <div className="heading-actions">
            <span className="date-label">
              <CalendarDays size={15} />
              30 tháng 9, 2026 · Demo
            </span>
            <Button asChild variant="outline">
              <Link href="/reports/FPT">
                <FileText size={14} />
                Báo cáo nghiên cứu
              </Link>
            </Button>
          </div>
        }
      />
      <div className="market-grid">
        {marketIndices.map((index, i) => (
          <div className="market-card" key={index.symbol}>
            <div className="market-card-top">
              <strong>{index.symbol}</strong>
              <span>{index.name} · MOCK</span>
            </div>
            <div className="market-value">{number(index.value, 2)}</div>
            <div className="market-bottom">
              <Change value={index.change} />
              <Sparkline seed={i * 2} down={index.change < 0} />
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Diễn biến thị trường"
          subtitle="VN-INDEX · Chuỗi chỉ số minh họa"
          action={<MockBadge />}
          className="chart-panel"
        >
          <div className="chart-metric">
            <strong>1.287,94</strong>
            <Change value={0.84} />
            <span>+10,73 điểm</span>
          </div>
          <PriceChart data={marketHistory} label="VN-INDEX" unit="điểm" />
          <SourceNote />
        </Panel>
        <Panel
          title="Tiêu điểm nghiên cứu"
          action={<Sparkles size={17} className="positive" />}
          className="focus-panel"
        >
          <div className="focus-content">
            <span className="focus-label">RESEARCH FRAMEWORK</span>
            <h3>Giá trị phía sau con số.</h3>
            <p>
              Bắt đầu với doanh nghiệp, kiểm tra dòng tiền, rồi đặt câu hỏi về
              mức định giá.
            </p>
            <div className="focus-points">
              <div className="focus-point">
                <FileSearch size={16} />
                Đọc chất lượng lợi nhuận
              </div>
              <div className="focus-point">
                <Scale size={16} />
                Đối chiếu giả định định giá
              </div>
              <div className="focus-point">
                <ShieldCheck size={16} />
                Xem xét luận điểm phản biện
              </div>
            </div>
            <Button asChild>
              <Link href="/stocks/FPT">Khám phá hồ sơ FPT</Link>
            </Button>
          </div>
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Watchlist />
        <Panel
          title="Điểm cần lưu ý"
          subtitle="Checklist nghiên cứu · Không phải cảnh báo thực"
        >
          <div className="risk-item">
            <TriangleAlert className="risk-icon" size={17} />
            <div>
              <h3>Chất lượng dữ liệu</h3>
              <p>
                Chưa có nguồn thị trường được xác minh. Mọi số liệu hiện tại đều
                là mock.
              </p>
              <span className="badge mock-badge">CẦN XÁC MINH</span>
            </div>
          </div>
          <div className="risk-item">
            <Scale className="risk-icon" size={17} />
            <div>
              <h3>Độ nhạy của định giá</h3>
              <p>
                Kiểm tra tăng trưởng, chi phí vốn và biên an toàn trước khi kết
                luận.
              </p>
              <span className="badge">CHECKLIST</span>
            </div>
          </div>
          <div className="risk-item">
            <Info className="risk-icon" size={17} />
            <div>
              <h3>Đặc thù ngành ngân hàng</h3>
              <p>
                Mô hình định giá cần phù hợp với cấu trúc tài sản và vốn của
                doanh nghiệp.
              </p>
              <span className="badge">PHẠM VI MÔ HÌNH</span>
            </div>
          </div>
        </Panel>
      </div>
      <Panel
        title="Hồ sơ nghiên cứu mẫu"
        subtitle="Khung báo cáo để bắt đầu nghiên cứu của bạn"
        action={<span className="badge">3 BẢN MẪU</span>}
      >
        <div className="research-grid">
          {[
            {
              symbol: "FPT",
              title: "Chất lượng tăng trưởng & lợi thế cạnh tranh",
              sector: "Công nghệ",
            },
            {
              symbol: "VNM",
              title: "Dòng tiền, cổ tức & hiệu quả sử dụng vốn",
              sector: "Tiêu dùng",
            },
            {
              symbol: "HPG",
              title: "Chu kỳ ngành & cấu trúc tài chính",
              sector: "Vật liệu",
            },
          ].map((r) => (
            <Link
              key={r.symbol}
              href={`/reports/${r.symbol}`}
              className="research-card"
            >
              <div className="research-meta">
                <span>
                  {r.symbol} <span className="footer-dot">/</span>
                  {r.sector}
                </span>
                <FileText size={15} />
              </div>
              <h3>{r.title}</h3>
              <p>Khung minh họa · Chưa có kết luận phân tích</p>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
