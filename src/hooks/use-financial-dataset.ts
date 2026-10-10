"use client";

import { useState } from "react";
import { parseFinancialDataset } from "@/lib/financial/schema";
import type { FinancialDataset, Industry } from "@/lib/financial/types";

export const MAX_FINANCIAL_JSON_BYTES = 1024 * 1024;

export function useFinancialDataset(symbol: string, industry: Industry) {
  const [raw, setRaw] = useState("");
  const [dataset, setDataset] = useState<FinancialDataset | null>(null);
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  function edit(next: string) {
    setRaw(next); setDirty(true); setIssues([]); setMessage("");
  }

  function apply(next: string = raw) {
    setRaw(next);
    setDirty(true);
    setMessage("");
    if (new TextEncoder().encode(next).byteLength > MAX_FINANCIAL_JSON_BYTES) {
      setIssues(["Tệp JSON vượt quá 1 MB."]);
      return false;
    }
    const parsed = parseFinancialDataset(next);
    if (!parsed.ok) { setIssues(parsed.issues); return false; }
    if (parsed.value.symbol !== symbol) {
      setIssues([`Mã trong JSON phải là ${symbol}. Hãy mở đúng trang cổ phiếu hoặc kiểm tra tệp.`]);
      return false;
    }
    if (parsed.value.industry !== industry) {
      setIssues([`Loại doanh nghiệp không khớp ${symbol}: trang này yêu cầu ${industry}.`]);
      return false;
    }
    setDataset(parsed.value); setDirty(false); setIssues([]);
    setMessage("Đã kiểm tra cấu trúc và áp dụng dữ liệu. Nội dung nguồn chưa được xác minh.");
    return true;
  }

  function save() {
    if (!dataset || dirty) return;
    try {
      localStorage.setItem(`equitylens.financial.v2.${symbol}`, JSON.stringify(dataset));
      setMessage(`Đã lưu dữ liệu ${symbol} trong trình duyệt này. Tải JSON để có bản sao trên máy.`);
      setIssues([]);
    } catch { setIssues(["Không lưu được vào trình duyệt. Hãy tải JSON để lưu trên máy."]); }
  }

  function load() {
    try {
      const saved = localStorage.getItem(`equitylens.financial.v2.${symbol}`);
      if (!saved) { setMessage(`Chưa có dữ liệu ${symbol} được lưu trong trình duyệt này.`); return; }
      if (apply(saved)) setMessage(`Đã nạp bản lưu ${symbol} và kiểm tra lại cấu trúc. Nguồn vẫn chưa được xác minh.`);
    } catch { setIssues(["Không đọc được bản lưu trong trình duyệt. Bạn có thể nhập lại tệp JSON."]); }
  }

  return { raw, dataset: dirty ? null : dataset, dirty, issues, message, edit, apply, save, load, setIssues, setMessage };
}
