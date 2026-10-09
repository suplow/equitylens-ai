import { Download, Info } from "lucide-react";
import type { Stock } from "@/lib/data/types";
import { Button } from "./ui/button";
import { Panel, SourceNote } from "./shared";
export function ResearchReport({ stock }: { stock: Stock }) {
  const sections = [
    [
      "Executive Summary",
      "Chưa có kết luận nghiên cứu. Phần này sẽ tổng hợp chất lượng doanh nghiệp, định giá và các rủi ro sau khi dữ liệu được xác minh.",
    ],
    ["Business Overview", stock.description],
    [
      "Financial Performance",
      "Cần đối chiếu doanh thu, lợi nhuận, dòng tiền và cơ cấu tài sản qua nhiều kỳ. Bảng tài chính hiện tại chỉ là dữ liệu minh họa.",
    ],
    [
      "Valuation",
      "Chưa có kết quả định giá. Cần lựa chọn phương pháp phù hợp, công khai giả định và kiểm tra độ nhạy của mô hình.",
    ],
    [
      "Investment Thesis",
      "Khung luận điểm: lợi thế cạnh tranh là gì, có bằng chứng nào hỗ trợ, và điều kiện nào khiến luận điểm không còn đúng?",
    ],
    [
      "Key Risks",
      "Checklist: chất lượng dữ liệu, rủi ro ngành, đòn bẩy, phân bổ vốn và mức độ phụ thuộc vào các giả định. Đây chưa phải đánh giá rủi ro cụ thể của doanh nghiệp.",
    ],
    [
      "Bull / Bear Case",
      "Chưa thiết lập kịch bản. Mỗi kịch bản cần giả định minh bạch, nguồn dữ liệu và điều kiện kiểm chứng trước khi đưa ra nhận định.",
    ],
  ];
  return (
    <>
      <div className="notice">
        <Info size={18} />
        <p>
          <strong>Bản mẫu chưa có kết luận đầu tư.</strong> Xuất PDF sẽ được bổ
          sung khi quy trình tạo báo cáo và trích dẫn được hoàn thiện.
        </p>
      </div>
      <Panel
        title="Báo cáo nghiên cứu"
        subtitle="Khung báo cáo · Không phải nghiên cứu đã xác minh"
        action={
          <Button
            variant="outline"
            disabled
            title="Xuất PDF chưa được triển khai"
          >
            <Download size={14} />
            Xuất PDF · Sắp có
          </Button>
        }
      >
        <article className="report">
          <p className="report-label">RESEARCH TEMPLATE / MOCK DATA</p>
          <h2>
            {stock.symbol} — {stock.name}
          </h2>
          <p className="report-intro">
            {stock.sector} · {stock.exchange} · Mốc dữ liệu minh họa: 30/09/2026
          </p>
          {sections.map(([title, text], i) => (
            <section className="report-section" key={title}>
              <h3>
                <span>0{i + 1}</span>
                {title}
              </h3>
              <p>{text}</p>
            </section>
          ))}
        </article>
        <SourceNote />
      </Panel>
    </>
  );
}
