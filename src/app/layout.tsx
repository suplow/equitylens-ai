import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "EquityLens AI | Equity Research",
  description:
    "Không gian nghiên cứu cổ phiếu Việt Nam — phiên bản minh họa, dữ liệu giả lập.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
