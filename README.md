# EquityLens AI — Phase 1

Dashboard nghiên cứu cổ phiếu Việt Nam, chạy cục bộ với Next.js, TypeScript, Tailwind CSS, shadcn-compatible Button, Recharts và Zod.

**Mọi giá và số liệu tài chính đều là mock. Không có dữ liệu thị trường thực, kết quả định giá hay phân tích do AI tạo.** Các fixture gắn nguồn `EquityLens · Bộ dữ liệu minh họa v1` và mốc minh họa 30/09/2026. Mốc này không phải thời gian đồng bộ thị trường.

## Chạy trên máy

Đã kiểm tra trên Windows, Node.js 25.2.1 và npm 11.6.2.

```powershell
cd "C:\Users\khoa\Documents\Codex\2026-10-09\h-y\outputs\equitylens-ai"
npm ci
npm run dev -- --hostname 127.0.0.1
```

Mở http://127.0.0.1:3000. Nếu cổng đang được sử dụng, xem terminal hoặc chọn `--port 3001`.

Không cần API key, database hoặc dịch vụ trả phí. Chưa deploy production.

## Đã có

- Dashboard: chỉ số thị trường mock, biểu đồ, watchlist, checklist rủi ro và liên kết hồ sơ mẫu.
- Tìm kiếm sáu mã HOSE minh họa: FPT, VNM, HPG, VCB, MBB, REE. Không tìm thấy có thông báo rõ ràng.
- Stock Overview: hồ sơ, chỉ số mock, biểu đồ chọn 1/2/3 tháng (30/60/90 ngày lịch giả lập).
- Watchlist thêm/bỏ mã, lưu bằng localStorage trên trình duyệt. Không đồng bộ tài khoản.
- Financial Analysis: ba bảng báo cáo rút gọn, bốn năm mock, biểu đồ so sánh và chỉ số minh họa.
- Valuation: khung phương pháp và kịch bản, kết quả để trống, chưa cho nhập giả định.
- AI Analyst: soạn câu hỏi và chọn gợi ý; nút gửi bị vô hiệu hóa và không có request AI.
- Research Reports: đủ bảy phần của bản mẫu; xuất PDF chưa được triển khai.
- Sidebar desktop, menu mobile, focus states, điều hướng bàn phím, bảng cuộn ngang trong vùng chứa.
- Data Provider Interface để thay fixture bằng adapter được cấp phép ở Phase 4.

## Cấu trúc

```text
src/app/                       Routes, layout, global design tokens
src/app/[section]/[symbol]/    Trang theo mã, kiểm tra tham số bằng Zod
src/components/                Dashboard và từng chức năng nghiên cứu
src/components/ui/             Button dùng Radix Slot + CVA
src/hooks/                     Watchlist cục bộ
src/lib/data/                  Kiểu dữ liệu, provider contract, mock fixtures
src/lib/                       Định dạng số và tiện ích giao diện
src/lib/data/*.test.ts          Kiểm thử biên dữ liệu
 tests/                        Kiểm thử Playwright
 tasks/                        Kế hoạch và checklist
 qa/                           Ảnh kiểm tra desktop/mobile
```

Các route: `/`, `/stocks/FPT`, `/financials/FPT`, `/valuation/FPT`, `/analyst/FPT`, `/reports/FPT`. Thay FPT bằng mã demo khác. Điều hướng giữ mã đang xem.

## Kiểm tra

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Playwright mặc định dùng Chromium tải riêng:

```powershell
npx playwright install chromium
npm run test:e2e
```

Nếu tải Chromium bị timeout, có thể dùng Chrome đã cài. Playwright tạo hồ sơ test tách biệt, không dùng phiên đăng nhập cá nhân:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test:e2e
```

E2E kiểm tra tìm mã, không tìm thấy, biểu đồ, watchlist sau reload, trạng thái rỗng, giữ mã giữa các trang, chuyển loại báo cáo, chức năng chưa bật, lỗi runtime/console và responsive 320/390/768/1024/1440 px. Playwright tự chạy dev server hoặc dùng server sẵn có ở cổng 3000.

## Ranh giới dữ liệu

Các chỉ số P/E, P/B, ROE và vốn hóa là giá trị mock độc lập, chưa tính từ bảng tài chính mock. Bảng tài chính rút gọn không phải báo cáo đầy đủ và không được dùng để suy ra sức khỏe doanh nghiệp. Các chỉ số ngân hàng chỉ minh họa bố cục; chưa có schema ngành ngân hàng chuyên biệt.

Provider hiện trả `null` cho mã không có. Adapter dữ liệu thật sau này cần bổ sung thông tin thời điểm công bố, kỳ báo cáo, kiểm toán, đơn vị, giá điều chỉnh và các trường thiếu; không được điền 0 hoặc tự sinh số liệu thay cho dữ liệu thiếu.

Bốn lớp dữ liệu tương lai (`verified`, `calculated`, `assumption`, `interpretation`) đã có trong kiểu provenance. Chỉ `mock` đang được sử dụng. Không có kết quả nào được gắn nhãn verified.

## Các phase tiếp theo

1. Phase 2: schema đầy đủ và riêng cho ngành cần thiết; công thức ratio, DCF/phương pháp phù hợp, kịch bản và sensitivity; unit tests cho công thức và trường hợp thiếu dữ liệu.
2. Phase 3: API backend, OpenAI server-only, đối chiếu citation với source allowlist, kiểm chứng số liệu, phân biệt suy luận và dữ kiện; kiểm tra prompt injection. Những cơ chế này **chưa được triển khai** ở Phase 1.
3. Phase 4: kiểm chứng nguồn dữ liệu Việt Nam và giấy phép; adapter thực, lưu trữ và lịch cập nhật khi cần.
4. Báo cáo hoàn chỉnh và xuất PDF cần triển khai thêm sau khi có dữ liệu và quy trình trích dẫn.

Khi triển khai Phase 3, lưu `OPENAI_API_KEY` trong `.env.local` (đã gitignore); không đưa vào biến `NEXT_PUBLIC_*`, client bundle, chat hoặc Git. File `.env.example` chỉ là hướng dẫn, ứng dụng hiện không đọc khóa và không gọi API.

## Dependency audit

Ngày kiểm tra: 09/10/2026. `npm audit --omit=dev` không phát hiện lỗ hổng. Full audit ghi nhận 5 mục high trong một chuỗi dependency phát triển: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. Registry hiện cung cấp braces 3.0.3, vẫn thuộc phạm vi advisory GHSA-vfj7-8cjw-p6xm. Không chạy `npm audit fix --force` vì gợi ý của npm hạ eslint-config-next về major không phù hợp với Next.js hiện tại. Cần kiểm tra lại bản vá trước khi nâng cấp hoặc triển khai môi trường thực.

## Tài liệu tham chiếu

- Next.js: https://nextjs.org/docs/app/getting-started/installation
- Recharts: https://recharts.github.io/api/ResponsiveContainer/

Ứng dụng không đặt lệnh giao dịch và không đưa ra khuyến nghị đầu tư.
