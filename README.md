# EquityLens AI — Local Research Workspace

Dashboard nghiên cứu cổ phiếu Việt Nam, chạy cục bộ với Next.js, TypeScript, Tailwind CSS, shadcn-compatible Button, Recharts và Zod.

**Phase 2 đã có Financial Engine chạy local:** nhập JSON báo cáo có nguồn, tính 27 tỷ số, DCF–FCFF, P/E/P/B/EV–EBITDA, Bear/Base/Bull và sensitivity. Kết quả tính từ dữ liệu/giả định bạn cung cấp, không phải dự báo giá hoặc xác minh báo cáo.

**Giá và số liệu có sẵn vẫn là MOCK.** Dashboard/Stock Overview và tab **Dữ liệu minh họa Phase 1** giữ fixture v1 (mốc minh họa 30/09/2026). Engine có fixture luyện tập riêng, được đánh dấu MOCK cả trên kết quả. Không đồng bộ dữ liệu thị trường thật.

**AI Analyst hiện có luồng dùng tài khoản ChatGPT sẵn có, chuyển hồ sơ thủ công:** chuẩn bị nguồn tại local → copy/download sang ChatGPT → dán JSON phản hồi về để kiểm tra cấu trúc và ID nguồn. Mặc định loại số mock khỏi hồ sơ; nguồn tự nhập luôn chưa xác minh. Web chạy local nhưng ChatGPT xử lý trực tuyến. Không cần API key và không tự gửi dữ liệu.

- [Yêu cầu nghiên cứu của agent tài chính](docs/research/AI_EQUITY_REQUIREMENTS.md)
- [Handoff từ agent cầu nối sang thiết kế](docs/research/PRODUCT_HANDOFF.md)
- [Cách dùng ChatGPT và giới hạn kết nối](docs/research/CHATGPT_LOCAL_WORKFLOW.md)
- [Trải nghiệm và luồng giao diện](docs/research/UX_NOTES.md)
- [Cách nhập dữ liệu, đơn vị, kỳ và lưu local](docs/FINANCIAL_DATA.md)
- [Định nghĩa 27 tỷ số](docs/FINANCIAL_FORMULAS.md)
- [Phương pháp định giá và giới hạn](docs/VALUATION_METHODS.md)
- [Báo cáo thực hiện Phase 2](docs/PHASE2_REPORT.md)

## Chạy trên máy

Đã kiểm tra trên Windows, Node.js 25.2.1 và npm 11.6.2.

```powershell
cd "C:\Users\khoa\Documents\Codex\2026-10-09\h-y\outputs\equitylens-ai"
npm ci
npm run dev
```

Mở http://127.0.0.1:3000. Nếu cổng đang được sử dụng, xem terminal hoặc chọn `--port 3001`.

Không cần API key, database hoặc dịch vụ trả phí. Chưa deploy production.

## Đã có

- Dashboard: chỉ số thị trường mock, biểu đồ, watchlist, checklist rủi ro và liên kết hồ sơ mẫu.
- Tìm kiếm sáu mã HOSE minh họa: FPT, VNM, HPG, VCB, MBB, REE. Không tìm thấy có thông báo rõ ràng.
- Stock Overview: hồ sơ, chỉ số mock, biểu đồ chọn 1/2/3 tháng (30/60/90 ngày lịch giả lập).
- Watchlist thêm/bỏ mã, lưu bằng localStorage trên trình duyệt. Không đồng bộ tài khoản.
- Financial Analysis: nhập tệp/dán JSON, ba báo cáo chuẩn hóa, 27 tỷ số có công thức và nguồn, bình quân đầu/cuối kỳ, so sánh năm cùng scope/basis, xem dòng quý suy từ YTD và cảnh báo thiếu/mâu thuẫn. Có tab giữ nguyên bốn năm demo Phase 1.
- Valuation: giả định sửa trực tiếp, ba kịch bản DCF–FCFF, dự phóng từng năm, equity bridge, giá trị/cp, chênh lệch giá/MOS và ma trận 5×5; P/E/P/B/EV–EBITDA, peer JSON có nguồn và ghi chú khác biệt. Ngân hàng/chứng khoán/bảo hiểm khóa kết quả vì chưa có mô hình chuyên ngành.
- Bộ dữ liệu lưu/tải chủ động qua localStorage theo mã; xuất JSON sao lưu. Giả định lưu riêng theo mã/kỳ. Dữ liệu tự nhập luôn chưa xác minh, không cần API key.
- AI Analyst: nhập nguồn có kỳ/ngày/trang, tạo snapshot, xuất prompt cho ChatGPT, nhập JSON và kiểm tra mã/snapshot/source IDs. Không xác minh sự thật; phản hồi luôn cần đối chiếu tài liệu.
- Research Reports: đủ bảy phần của bản mẫu; xuất PDF chưa được triển khai.
- Sidebar desktop, menu mobile, focus states, điều hướng bàn phím, bảng cuộn ngang trong vùng chứa.
- Data Provider Interface để thay fixture bằng adapter được cấp phép ở Phase 4.

## Cấu trúc

```text
src/app/                       Routes, layout, global design tokens
src/app/[section]/[symbol]/    Trang theo mã, kiểm tra tham số bằng Zod
src/components/                Dashboard và từng chức năng nghiên cứu
src/components/ui/             Button dùng Radix Slot + CVA
src/hooks/                     Watchlist và bộ dữ liệu tài chính cục bộ
src/lib/data/                  Kiểu dữ liệu, provider contract, mock fixtures
src/lib/financial/             Schema v2, normalization, ratios, valuation, peers và unit tests
src/lib/research/              Hồ sơ nguồn, prompt và kiểm tra phản hồi JSON
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

E2E kiểm tra tìm mã, không tìm thấy, biểu đồ, watchlist sau reload, trạng thái rỗng, giữ mã giữa các trang, tab demo cũ, lỗi runtime/console và responsive 320/390/768/1024/1440 px. Phase 2 thêm nhập/kiểm tra/xuất JSON, lưu và tải lại, tỷ số khớp số tính tay, DCF với bài tính độc lập, sensitivity, đổi/lưu giả định, peer median, dữ liệu thiếu/âm và khóa ngân hàng. Playwright tự chạy dev server hoặc dùng server sẵn có ở cổng 3000.

Luồng nghiên cứu có kiểm thử nguồn tự nhập, clipboard Windows, tải TXT/JSON, nhập báo cáo và mở trích dẫn, nguồn lạ/snapshot cũ, đổi mã, opt-in MOCK, bản mẫu trống và HTML chỉ hiển thị như văn bản. Kiểm thử dùng phản hồi giả lập có nhãn kiểm thử; chưa gửi yêu cầu thật tới ChatGPT.

## Ranh giới dữ liệu

Chỉ số P/E, P/B, ROE và vốn hóa **trên dashboard/Stock Overview/tab demo Phase 1** là mock độc lập, chưa tính từ bảng mock cũ. Financial Engine tách dataset v2, không lấy số cũ để tính. Ngân hàng/chứng khoán/bảo hiểm có schema khung riêng, chưa đầy đủ cho tính tỷ số/định giá; các kết quả đó bị khóa.

Provider hiện trả `null` cho mã không có. Adapter dữ liệu thật sau này cần bổ sung thông tin thời điểm công bố, kỳ báo cáo, kiểm toán, đơn vị, giá điều chỉnh và các trường thiếu; không được điền 0 hoặc tự sinh số liệu thay cho dữ liệu thiếu.

Bốn lớp dữ liệu (`verified`, `calculated`, `assumption`, `interpretation`) đã có trong kiểu provenance. Provider dashboard chỉ dùng `mock`. Engine nhận `user_supplied` hoặc `mock`, kết quả có input source IDs và cờ MOCK lan truyền. Hồ sơ ChatGPT riêng nhận nguồn `provided_unverified`, giả định người dùng và phản hồi chưa kiểm chứng; chưa tự đính kèm kết quả Engine. Không có dữ liệu nào được gắn nhãn verified.

Thử nhanh: vào `/financials/FPT` → **Nạp dữ liệu MOCK** → xem công thức → **Lưu dữ liệu local** → sang `/valuation/FPT` → **Tải bản đã lưu** → **Nạp giả định MOCK** → thay WACC hoặc CAPEX. Với báo cáo thực, tải mẫu JSON trống và nhập số từ nguồn đã đối chiếu; giữ trường thiếu là null.

## Các phase tiếp theo

1. Mở rộng Engine: TTM, schema/mô hình định chế tài chính hoàn chỉnh, valuation tại ngày cụ thể, terminal reinvestment/ROIC, corporate actions/FX, thêm mã và bundle nghiên cứu gồm peer/assumption lineage.
2. AI tự động: có thể đánh giá Codex SDK/app-server đăng nhập ChatGPT sau khi cấu hình và kiểm thử; chưa triển khai. Theo lựa chọn hiện tại không dùng API trả phí. Luồng thủ công đã có kiểm tra schema/source IDs, nhưng kiểm chứng số liệu và nội dung citation chưa được triển khai.
3. Phase 4: kiểm chứng nguồn dữ liệu Việt Nam và giấy phép; adapter thực, lưu trữ và lịch cập nhật khi cần.
4. Báo cáo hoàn chỉnh và xuất PDF cần triển khai thêm sau khi có dữ liệu và quy trình trích dẫn.

Theo lựa chọn hiện tại, không cần cấu hình `OPENAI_API_KEY`. File `.env.example` chỉ để tham khảo cho phương án API sau này; ứng dụng không đọc khóa hoặc gọi API. Chỉ khi người dùng chủ động đổi sang phương án API có tính phí mới cấu hình khóa phía server trong `.env.local` (đã gitignore), tuyệt đối không dùng `NEXT_PUBLIC_*` hay đưa khóa vào Git.

## Dependency audit

Ngày kiểm tra: 09/10/2026. `npm audit --omit=dev` không phát hiện lỗ hổng. Full audit ghi nhận 5 mục high trong một chuỗi dependency phát triển: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. Registry hiện cung cấp braces 3.0.3, vẫn thuộc phạm vi advisory GHSA-vfj7-8cjw-p6xm. Không chạy `npm audit fix --force` vì gợi ý của npm hạ eslint-config-next về major không phù hợp với Next.js hiện tại. Cần kiểm tra lại bản vá trước khi nâng cấp hoặc triển khai môi trường thực.

## Tài liệu tham chiếu

- Next.js: https://nextjs.org/docs/app/getting-started/installation
- Recharts: https://recharts.github.io/api/ResponsiveContainer/

Ứng dụng không đặt lệnh giao dịch và không đưa ra khuyến nghị đầu tư.
