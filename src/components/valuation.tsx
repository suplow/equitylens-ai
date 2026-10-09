import { Calculator, Scale, BarChart3, Info } from "lucide-react";
import type { Stock } from "@/lib/data/types";
import { Panel } from "./shared";
export function Valuation({ stock }: { stock: Stock }) {
  return (
    <>
      <div className="notice">
        <Info size={18} />
        <p>
          <strong>Không có kết quả định giá trong Phase 1.</strong> Mô hình cần
          Financial Engine và dữ liệu được kiểm chứng. Các trường bên dưới mô tả
          dữ liệu cần chuẩn bị cho {stock.symbol}.
        </p>
      </div>
      <div className="preview-grid">
        {[
          {
            icon: Calculator,
            title: "Chiết khấu dòng tiền",
            text:
              stock.sector === "Ngân hàng"
                ? "DCF dòng tiền doanh nghiệp thông thường chưa phù hợp với ngân hàng. Cần đánh giá mô hình thu nhập thặng dư hoặc cổ tức."
                : "Đánh giá tính phù hợp của FCFF hoặc FCFE, xác định dòng tiền cơ sở và giả định tăng trưởng.",
          },
          {
            icon: Scale,
            title: "Định giá tương đối",
            text: "P/E, P/B và EV/EBITDA chỉ được sử dụng khi có dữ liệu đầy đủ và phù hợp với ngành.",
          },
          {
            icon: BarChart3,
            title: "Doanh nghiệp so sánh",
            text: "Chọn nhóm doanh nghiệp tương đồng, chuẩn hóa kỳ báo cáo và kiểm tra các khác biệt trọng yếu.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <section className="preview-card" key={title}>
            <Icon size={23} />
            <h2>{title}</h2>
            <p>{text}</p>
            <span className="badge">PHASE 2 · CHƯA KÍCH HOẠT</span>
          </section>
        ))}
      </div>
      <Panel
        title="Giả định của nhà phân tích"
        subtitle="Analyst Assumptions · Chưa có giả định được nhập"
        className="section-gap"
      >
        <div className="assumption-grid">
          {[
            "Tăng trưởng doanh thu (%)",
            "Chi phí vốn (%)",
            "Tăng trưởng dài hạn (%)",
          ].map((label) => (
            <label key={label}>
              {label}
              <input disabled placeholder="Chưa thiết lập" />
            </label>
          ))}
        </div>
      </Panel>
      <Panel
        title="Bear / Base / Bull"
        subtitle="Giá trị hợp lý, biên an toàn & phân tích độ nhạy"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>KỊCH BẢN</th>
                <th>GIÁ TRỊ HỢP LÝ</th>
                <th>BIÊN AN TOÀN</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {["Bear · Thận trọng", "Base · Cơ sở", "Bull · Tích cực"].map(
                (label) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>Chưa tính toán</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <p className="phase-placeholder">
          Bảng độ nhạy sẽ khả dụng khi mô hình và giả định đã được kiểm tra.
        </p>
      </Panel>
    </>
  );
}
