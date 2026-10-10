"use client";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";
import type { FinancialPeriod, Stock } from "@/lib/data/types";
import { number } from "@/lib/format";
import { MockBadge, Panel, SourceNote } from "./shared";
import { FinancialWorkspace } from "./financial-workspace";
const statements: {
  label: string;
  rows: { key: keyof FinancialPeriod; label: string }[];
}[] = [
  {
    label: "Kết quả kinh doanh",
    rows: [
      { key: "revenue", label: "Doanh thu thuần" },
      { key: "netIncome", label: "Lợi nhuận sau thuế" },
    ],
  },
  {
    label: "Bảng cân đối kế toán",
    rows: [
      { key: "assets", label: "Tổng tài sản" },
      { key: "equity", label: "Vốn chủ sở hữu" },
      { key: "debt", label: "Nợ vay" },
      { key: "cash", label: "Tiền & tương đương tiền" },
    ],
  },
  {
    label: "Lưu chuyển tiền tệ",
    rows: [
      { key: "operatingCashFlow", label: "Dòng tiền từ hoạt động kinh doanh" },
      { key: "capex", label: "Chi đầu tư tài sản cố định (số dương)" },
    ],
  },
];
export function FinancialAnalysis({ stock }: { stock: Stock }) {
  return <FinancialWorkspace key={stock.symbol} stock={stock} view="financials" demo={<DemoFinancialAnalysis stock={stock} />} />;
}
function DemoFinancialAnalysis({ stock }: { stock: Stock }) {
  const [tab, setTab] = useState(0);
  return (
    <>
      <div className="notice">
        <Info size={18} />
        <p>
          <strong>Báo cáo rút gọn để minh họa giao diện.</strong> Đơn vị: tỷ
          VND. Các kỳ 2022–2025 đều là dữ liệu giả lập, chưa kiểm toán và không
          đại diện cho báo cáo thực tế của {stock.symbol}.
        </p>
      </div>
      <Panel
        title="Báo cáo tài chính"
        subtitle={`${stock.symbol} · Theo năm · Tỷ VND`}
        action={<MockBadge />}
        className="section-gap"
      >
        <div className="statement-tabs" aria-label="Loại báo cáo">
          {statements.map((s, i) => (
            <button
              key={s.label}
              aria-pressed={tab === i}
              onClick={() => setTab(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="table-scroll">
          <table className="financial-table">
            <thead>
              <tr>
                <th>CHỈ TIÊU · TỶ VND</th>
                {stock.financials.map((p) => (
                  <th key={p.year}>{p.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statements[tab].rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  {stock.financials.map((p) => (
                    <td key={p.year}>{number(p[row.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SourceNote />
      </Panel>
      <div className="dashboard-grid">
        <Panel
          title="So sánh qua các năm"
          subtitle="Doanh thu & lợi nhuận sau thuế · Tỷ VND"
        >
          <div
            className="financial-chart"
            role="img"
            aria-label="Biểu đồ doanh thu và lợi nhuận giả lập năm 2022 đến 2025"
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 640, height: 260 }}
            >
              <BarChart data={stock.financials} barGap={5}>
                <CartesianGrid
                  vertical={false}
                  stroke="#283344"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#a0acc0", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#a0acc0", fontSize: 10 }}
                  tickFormatter={(v) => number(v)}
                  width={55}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#172232",
                    border: "1px solid #354459",
                    borderRadius: 6,
                    color: "#edf1f7",
                  }}
                  formatter={(v) => number(Number(v))}
                  labelFormatter={(v) => `MOCK · ${v}`}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 14 }} />
                <Bar
                  name="Doanh thu"
                  dataKey="revenue"
                  fill="#77dfc2"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
                <Bar
                  name="Lợi nhuận sau thuế"
                  dataKey="netIncome"
                  fill="#5b7f9e"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SourceNote />
        </Panel>
        <Panel
          title="Sức khỏe tài chính"
          subtitle="Chưa có đánh giá được tính toán"
        >
          <p className="body-copy">
            Chưa chấm điểm doanh nghiệp từ dữ liệu giả lập. Financial Engine ở
            Phase 2 sẽ kiểm tra các nhóm chỉ số dưới đây.
          </p>
          <dl className="info-list">
            <div>
              <dt>Khả năng sinh lời</dt>
              <dd>Chưa đánh giá</dd>
            </div>
            <div>
              <dt>Thanh khoản</dt>
              <dd>Chưa đánh giá</dd>
            </div>
            <div>
              <dt>Đòn bẩy tài chính</dt>
              <dd>Chưa đánh giá</dd>
            </div>
            <div>
              <dt>Chất lượng dòng tiền</dt>
              <dd>Chưa đánh giá</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <Panel
        title="Chỉ số tài chính mẫu"
        subtitle="Giá trị mock độc lập · Chưa phải kết quả tính từ các báo cáo ở trên"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CHỈ SỐ</th>
                <th>GIÁ TRỊ MOCK</th>
                <th>PHÂN LOẠI</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["P/E", `${number(stock.pe ?? 0, 1)}x`],
                ["P/B", `${number(stock.pb ?? 0, 1)}x`],
                ["ROE", `${number(stock.roe, 1)}%`],
                ["Lợi suất cổ tức", `${number(stock.dividendYield, 1)}%`],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{value}</td>
                  <td>
                    <MockBadge />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SourceNote />
      </Panel>
    </>
  );
}
