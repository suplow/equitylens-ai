"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  LayoutDashboard,
  ChartNoAxesCombined,
  Table2,
  Calculator,
  Sparkles,
  FileText,
  Search,
  Menu,
  X,
  ChevronRight,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { stocks } from "@/lib/data/mock-provider";
import { Button } from "./ui/button";
const navigation = [
  { path: "", label: "Tổng quan", icon: LayoutDashboard },
  { path: "stocks", label: "Phân tích cổ phiếu", icon: ChartNoAxesCombined },
  { path: "financials", label: "Báo cáo tài chính", icon: Table2 },
  { path: "valuation", label: "Định giá", icon: Calculator },
  { path: "analyst", label: "AI Research Analyst", icon: Sparkles },
  { path: "reports", label: "Báo cáo nghiên cứu", icon: FileText },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const section = pathname.split("/")[1] ?? "";
  const symbol =
    stocks.find((s) => s.symbol === pathname.split("/")[2]?.toUpperCase())
      ?.symbol ?? "FPT";
  const results = stocks.filter((s) =>
    `${s.symbol} ${s.name}`
      .toLocaleLowerCase("vi")
      .includes(query.trim().toLocaleLowerCase("vi")),
  );
  function select(ticker: string) {
    router.push(`/stocks/${ticker}`);
    setQuery("");
    setSearchOpen(false);
    setOpen(false);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${open ? "sidebar-open" : ""}`}
        aria-label="Điều hướng chính"
      >
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-symbol">
            <Activity size={23} />
          </span>
          <span>
            EquityLens<span className="brand-ai">AI</span>
          </span>
        </Link>
        <div className="workspace-label">
          RESEARCH WORKSPACE <span>01</span>
        </div>
        <nav>
          {navigation.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              href={path ? `/${path}/${symbol}` : "/"}
              onClick={() => setOpen(false)}
              className={`nav-link ${section === path ? "active" : ""}`}
              aria-current={section === path ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {path === "analyst" && <span className="nav-ai">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <FlaskConical size={19} />
            <strong>{section === "analyst" ? "Nghiên cứu cùng ChatGPT" : "Không gian minh họa"}</strong>
            <p>
              {section === "analyst" ? "Chuẩn bị nguồn tại local, chuyển sang ChatGPT và đối chiếu phản hồi." : "Khám phá công cụ với dữ liệu giả lập. Không kết nối thị trường."}
            </p>
            <span className="badge">{section === "analyst" ? "CHUYỂN HỒ SƠ THỦ CÔNG" : "PHASE 01 · PREVIEW"}</span>
          </div>
          <div className="profile">
            <span className="avatar">EL</span>
            <div>
              <strong>Nhà đầu tư cá nhân</strong>
              <span>Local workspace</span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label={open ? "Đóng menu" : "Mở menu"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span className="breadcrumb-root">Workspace</span>
            <ChevronRight size={14} />
            <span>
              {navigation.find((n) => n.path === section)?.label ??
                "Nghiên cứu"}
            </span>
          </div>
          <div className="search-wrap">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                if (results[0]) select(results[0].symbol);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Tìm mã cổ phiếu"
                placeholder="Tìm mã cổ phiếu..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={(e) => {
                  if (
                    !e.currentTarget
                      .closest(".search-wrap")
                      ?.contains(e.relatedTarget)
                  )
                    setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchOpen(false);
                }}
              />
              <span className="search-hint">↵</span>
            </form>
            {searchOpen && (
              <div className="search-results">
                <p className="eyebrow">MÃ MINH HỌA · HOSE</p>
                {results.length ? (
                  results.map((s) => (
                    <button key={s.symbol} onClick={() => select(s.symbol)}>
                      <strong>{s.symbol}</strong>
                      <span>{s.name}</span>
                      <ChevronRight size={14} />
                    </button>
                  ))
                ) : (
                  <p className="empty-search">
                    Không tìm thấy mã “{query}”. Thử FPT, VNM hoặc HPG.
                  </p>
                )}
              </div>
            )}
          </div>
          <span className="topbar-mode">
            <span />
            {section === "analyst" ? "Local research" : "Demo mode"}
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="mock-banner">
            <FlaskConical size={15} />
            <span>
              <strong>{section === "analyst" ? "HỒ SƠ NGHIÊN CỨU LOCAL" : "DỮ LIỆU MINH HỌA"}</strong>
              <span className="banner-detail">
                {" "}
                {section === "analyst"
                  ? "· Tài liệu tự nhập chưa được xác minh. Số liệu demo không tự đưa vào hồ sơ."
                  : "· Tất cả giá và số liệu tài chính đều là giả lập, không dùng để ra quyết định đầu tư."}
              </span>
            </span>
            <span className="banner-date">{section === "analyst" ? "LOCAL WORKSPACE" : "30.09.2026"}</span>
          </div>
          {children}
          <footer>
            <span>
              EquityLens AI <span className="footer-dot">/</span> Fundamental
              research workspace
            </span>
            <span>{section === "analyst" ? "Hồ sơ chưa xác minh · Không phải khuyến nghị đầu tư" : "Dữ liệu minh họa · Không phải khuyến nghị đầu tư"}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
