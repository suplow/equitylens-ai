"use client";
import { useState } from "react";
import { Sparkles, Send, Info } from "lucide-react";
import type { Stock } from "@/lib/data/types";
import { Button } from "./ui/button";
import { Panel, SourceNote } from "./shared";
export function AiAnalyst({ stock }: { stock: Stock }) {
  const [draft, setDraft] = useState("");
  return (
    <>
      <div className="notice">
        <Info size={18} />
        <p>
          <strong>AI chưa được kết nối.</strong> Bạn có thể soạn câu hỏi để khám
          phá giao diện. Chưa có yêu cầu nào được gửi đi và chưa có nội dung do
          AI tạo.
        </p>
      </div>
      <div className="analyst-grid">
        <Panel
          title={`Nghiên cứu ${stock.symbol}`}
          subtitle={stock.name}
          action={<span className="badge">OFFLINE</span>}
        >
          <div className="analyst-welcome">
            <div className="analyst-mark">
              <Sparkles size={26} />
            </div>
            <h2>Một góc nhìn để kiểm chứng.</h2>
            <p>
              Đặt câu hỏi về doanh nghiệp, xem xét luận điểm đầu tư và tìm những
              giả định cần phản biện.
            </p>
            <div className="prompt-grid">
              {[
                `Chất lượng lợi nhuận của ${stock.symbol} cần kiểm tra những gì?`,
                `Những dữ liệu nào còn thiếu để định giá ${stock.symbol}?`,
                "Giải thích ROE và giới hạn khi sử dụng chỉ số này.",
                "Xây dựng luận điểm phản biện cho một doanh nghiệp tăng trưởng.",
              ].map((prompt) => (
                <button key={prompt} onClick={() => setDraft(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          <div className="chat-composer">
            <label htmlFor="analyst-question" className="sr-only">
              Câu hỏi cho AI Analyst
            </label>
            <textarea
              id="analyst-question"
              placeholder={`Đặt câu hỏi về ${stock.symbol}...`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={4000}
            />
            <div className="composer-bottom">
              <p>
                Phase 3 · Cần kết nối AI phía máy chủ.
                <br />
                Không nhập thông tin nhạy cảm vào câu hỏi.
              </p>
              <Button disabled>
                <Send size={14} />
                Gửi câu hỏi
              </Button>
            </div>
          </div>
        </Panel>
        <Panel
          title="Minh bạch nguồn dữ liệu"
          subtitle="Phân biệt dữ kiện và suy luận"
        >
          {[
            {
              title: "Verified Data",
              text: "Chưa có dữ liệu đã xác minh trong phiên bản này.",
            },
            {
              title: "Calculated Metrics",
              text: "Chưa có chỉ số do Financial Engine tính toán.",
            },
            {
              title: "Analyst Assumptions",
              text: "Chưa có giả định định giá được thiết lập.",
            },
            {
              title: "AI Interpretation",
              text: "Chưa có diễn giải do AI tạo.",
            },
            {
              title: "Mock Data · Đang sử dụng",
              text: "Bộ dữ liệu minh họa v1 · Mốc 30/09/2026. Không phải dữ liệu thị trường.",
            },
          ].map((item) => (
            <div className="data-type" key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          ))}
          <SourceNote />
        </Panel>
      </div>
    </>
  );
}
