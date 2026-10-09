"use client";
import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint } from "@/lib/data/types";
import { number } from "@/lib/format";
const ranges = [
  { label: "1T", days: 30 },
  { label: "2T", days: 60 },
  { label: "3T", days: 90 },
];
export function PriceChart({
  data,
  label,
  unit = "VND",
}: {
  data: PricePoint[];
  label: string;
  unit?: string;
}) {
  const [days, setDays] = useState(90);
  const id = useId().replaceAll(":", "");
  const points = data.slice(-days);
  return (
    <>
      <div className="chart-controls">
        <span className="chart-legend">
          {label} · {unit}
        </span>
        <div className="range-switch" aria-label="Khoảng thời gian">
          {ranges.map((range) => (
            <button
              key={range.label}
              aria-pressed={days === range.days}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="chart-area"
        role="img"
        aria-label={`Biểu đồ ${label}, ${days} ngày, dữ liệu minh họa`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 640, height: 224 }}
        >
          <AreaChart
            data={points}
            margin={{ top: 8, right: 3, left: 10, bottom: 5 }}
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#77dfc2" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#77dfc2" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#283344"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => `${date.slice(8)}/${date.slice(5, 7)}`}
              minTickGap={35}
              tick={{ fill: "#96a4b8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              dy={9}
            />
            <YAxis
              orientation="right"
              domain={["auto", "auto"]}
              tickFormatter={(value) => number(value)}
              tick={{ fill: "#96a4b8", fontSize: 10 }}
              width={58}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <Tooltip
              contentStyle={{
                background: "#172232",
                border: "1px solid #354459",
                borderRadius: 7,
                fontSize: 11,
                color: "#edf1f7",
              }}
              labelFormatter={(date) => `MOCK · ${date}`}
              formatter={(value) => [`${number(Number(value))} ${unit}`, label]}
            />
            <Area
              type="linear"
              dataKey="price"
              stroke="#77dfc2"
              strokeWidth={2}
              fill={`url(#${id})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-caption">
        {points[0].date} — {points.at(-1)?.date} · Chuỗi giả lập theo ngày lịch,
        không phải lịch giao dịch.
      </p>
    </>
  );
}
export function Sparkline({
  down = false,
  seed = 0,
}: {
  down?: boolean;
  seed?: number;
}) {
  const values = Array.from(
    { length: 23 },
    (_, i) =>
      `${i * 4},${(down ? 8 + i * 0.55 + Math.sin(i + seed) * 4 : 25 - i * 0.7 + Math.sin(i + seed) * 4).toFixed(2)}`,
  ).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 90 32" aria-hidden="true">
      <polyline
        points={values}
        fill="none"
        stroke={down ? "#f28c99" : "#78dcb4"}
        strokeWidth="1.6"
      />
    </svg>
  );
}
