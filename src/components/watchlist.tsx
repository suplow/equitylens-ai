"use client";
import Link from "next/link";
import { useState } from "react";
import { Star, Plus } from "lucide-react";
import { stocks } from "@/lib/data/mock-provider";
import { useWatchlist } from "@/hooks/use-watchlist";
import { number } from "@/lib/format";
import { Change, Panel, SourceNote } from "./shared";
import { Button } from "./ui/button";
export function Watchlist() {
  const { symbols, toggle, error } = useWatchlist();
  const [all, setAll] = useState(false);
  const items = all ? stocks : stocks.filter((s) => symbols.includes(s.symbol));
  return (
    <Panel
      title="Danh sách theo dõi"
      subtitle={`${symbols.filter((s) => stocks.some((stock) => stock.symbol === s)).length} cổ phiếu · Lưu trên trình duyệt này`}
      action={
        <Button variant="ghost" size="sm" onClick={() => setAll(true)}>
          <Plus size={14} />
          Thêm mã
        </Button>
      }
    >
      <div className="watchlist-tabs">
        <button aria-pressed={!all} onClick={() => setAll(false)}>
          Đang theo dõi
        </button>
        <button aria-pressed={all} onClick={() => setAll(true)}>
          Tất cả mã demo
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>CỔ PHIẾU</th>
              <th>GIÁ (VND)</th>
              <th>THAY ĐỔI</th>
              <th>P/E</th>
              <th>ROE</th>
              <th>
                <span className="sr-only">Theo dõi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.symbol}>
                <td>
                  <Link href={`/stocks/${s.symbol}`} className="ticker-cell">
                    <span className="ticker-icon">{s.symbol}</span>
                    <span>
                      <strong>{s.symbol}</strong>
                      <small>{s.sector}</small>
                    </span>
                  </Link>
                </td>
                <td>{number(s.price)}</td>
                <td>
                  <Change value={s.change} />
                </td>
                <td>{s.pe === null ? "—" : `${number(s.pe, 1)}x`}</td>
                <td>{number(s.roe, 1)}%</td>
                <td>
                  <button
                    className="star-button"
                    aria-label={`${symbols.includes(s.symbol) ? "Bỏ theo dõi" : "Theo dõi"} ${s.symbol}`}
                    aria-pressed={symbols.includes(s.symbol)}
                    onClick={() => toggle(s.symbol)}
                  >
                    <Star size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <p className="table-empty">
            Chưa có mã theo dõi. Chọn “Thêm mã” để bắt đầu.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <SourceNote />
    </Panel>
  );
}
export function WatchButton({ symbol }: { symbol: string }) {
  const { symbols, toggle, error } = useWatchlist();
  return (
    <div>
      <Button
        variant="outline"
        aria-pressed={symbols.includes(symbol)}
        onClick={() => toggle(symbol)}
      >
        <Star size={15} />
        {symbols.includes(symbol) ? "Đang theo dõi" : "Theo dõi"}
      </Button>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </div>
  );
}
