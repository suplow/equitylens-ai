"use client";
import { useSyncExternalStore, useState } from "react";
const key = "equitylens.watchlist.v1";
const defaults = '["FPT","VNM","HPG","MBB"]';
function snapshot() {
  try {
    return localStorage.getItem(key) ?? defaults;
  } catch {
    return defaults;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("watchlist-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("watchlist-change", callback);
  };
}
export function useWatchlist() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => defaults);
  const [error, setError] = useState("");
  let symbols: string[];
  try {
    const parsed: unknown = JSON.parse(raw);
    symbols =
      Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
        ? parsed
        : JSON.parse(defaults);
  } catch {
    symbols = JSON.parse(defaults);
  }
  function toggle(symbol: string) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          symbols.includes(symbol)
            ? symbols.filter((s) => s !== symbol)
            : [...symbols, symbol],
        ),
      );
      window.dispatchEvent(new Event("watchlist-change"));
      setError("");
    } catch {
      setError(
        "Trình duyệt không cho phép lưu watchlist. Vui lòng bật lưu trữ cục bộ.",
      );
    }
  }
  return { symbols, toggle, error };
}
