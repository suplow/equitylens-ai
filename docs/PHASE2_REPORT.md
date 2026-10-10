# Phase 2 — Financial Intelligence Engine

Ngày hoàn thành kiểm tra: 10/10/2026. Branch làm việc: `feature/equitylens-foundation`. Kế thừa ứng dụng Phase 1, không khởi tạo lại, không thêm dependency, không gọi dịch vụ trả phí hoặc deploy.

## Đã triển khai

- Audit README, AGENTS, docs/research, routes/components/lib/provider và provenance trước khi sửa; baseline lint/typecheck/build và 15 unit tests thành công. Kế hoạch và rủi ro ở [PHASE2_PLAN.md](PHASE2_PLAN.md).
- Dataset v2 có type safety và Zod strict; ba báo cáo doanh nghiệp phi tài chính, metadata nguồn/vị trí/kỳ/phạm vi/kiểm toán/ngày công bố/currency/unit. `null` giữ thiếu dữ liệu. Kiểm tra ID nguồn, ngày, lịch tài chính, đơn vị giá/EPS, phạm vi số, một số quan hệ kế toán.
- Chuẩn hóa nghìn/triệu/tỷ về đơn vị tiền và số cổ phiếu thực; từ chối FX tự động. Phân biệt annual/quarter/YTD, chuyển dòng YTD sang quý từ hai kỳ tương thích, giữ số dư cuối kỳ và không trừ EPS; có lineage cả hai kỳ.
- 27 tỷ số cho doanh nghiệp phi tài chính, công thức và đầu vào có nguồn, dùng bình quân đầu-cuối kỳ khi cần, tăng trưởng cùng kỳ, không annualize ngầm. Null, mẫu số không dương, nguồn kỳ không tương thích và định chế tài chính có trạng thái chặn rõ.
- FCFF lịch sử và forecast từ doanh thu, biên EBIT, thuế, D&A, CAPEX, WC; hàm WACC, chiết khấu cuối năm, Gordon terminal, EV, equity bridge gồm cash/non-operating assets/debt/NCI/preferred/claims và giá trị mỗi cổ phiếu.
- Bear/Base/Bull nhập/sửa trực tiếp, EV/equity/per-share/upside/MOS, bảng forecast và bridge, sensitivity 5×5 dùng cùng engine. Giả định thiếu giữ trống, chỉ MOCK được nạp preset.
- P/E, P/B, EV/EBITDA relative valuation; peer JSON có nguồn, lý do chọn, khác biệt quy mô/tăng trưởng/lợi nhuận/cơ cấu vốn; median từ hệ số hợp lệ, không tạo peer.
- UI Financial Analysis/Valuation dùng design system cũ, bảng mở nguồn, biểu đồ lịch sử cùng scope/basis, cảnh báo dữ liệu và công thức. Import file/dán JSON, xuất JSON, lưu/tải chủ động localStorage; giả định lưu riêng theo mã/kỳ.
- Schema khung riêng cho bank/securities/insurance, khóa ratio corporate và mọi định giá cho ba nhóm. VCB/MBB không nhận corporate JSON để lách guard.
- Giữ dashboard, watchlist, sáu mã, chart, điều hướng, AI Analyst chuyển hồ sơ thủ công với ChatGPT và mẫu Research Reports. Bảng/kịch bản Phase 1 vẫn truy cập qua tab demo. Cập nhật nhãn trang để không gọi dữ liệu tự nhập là MOCK/Verified.

## Công thức và phương pháp

- [27 tỷ số, đầu vào, ý nghĩa và điều kiện khóa](FINANCIAL_FORMULAS.md).
- [DCF–FCFF, WACC, terminal value, equity bridge, scenario/sensitivity và relative valuation](VALUATION_METHODS.md).
- [Schema JSON, tiền tệ/đơn vị, kỳ, nguồn, nhập và lưu local](FINANCIAL_DATA.md).

Số liệu được tính bằng pure functions. Công thức không do ChatGPT tạo tại runtime. Một case E2E độc lập: doanh thu 1.200 triệu, EBIT 20%, thuế 20%, D&A 5%, CAPEX 7%, growth 0%, WC không đổi → FCFF 168 triệu/năm; WACC 10%, g 0% → EV 1.680 triệu; tiền 150 triệu, nợ 300 triệu, claims khác 0, 100.000 cổ phiếu → 15.300 VND/cp. Đây là **bài kiểm thử giả lập**, không phải định giá FPT.

## Kết quả kiểm tra thực tế

| Lệnh / kiểm tra | Kết quả |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 49 tests, 6 files; 34 tests Financial Engine và 15 tests cũ |
| `npm run build` | PASS — Next.js tạo 34 static pages, gồm dashboard và 30 ticker/section paths |
| `npm run test:e2e` với `PLAYWRIGHT_CHANNEL=chrome` | PASS — 16 tests (11 cũ, 5 Phase 2) |
| E2E riêng sau bổ sung responsive ratios | PASS — 5 tests Phase 2 |
| `git diff --check` | PASS; chỉ có thông báo Git chuyển LF/CRLF trên Windows |
| Ảnh UI | Đã xem kết quả DCF desktop và tỷ số mobile, bảng giữ cuộn ngang nội bộ |

Unit tests gồm golden values cho từng nhóm tỷ số, FCFF/WACC, discount factors, terminal/equity/per-share, negative/null/zero/nonfinite, invalid assumptions, đổi quy mô tiền/cổ phiếu tương đương, năm tài chính không kết thúc tháng 12, YTD, scope/basis, dữ liệu mâu thuẫn, scenario/sensitivity, peer và sector guard. Integration tests kiểm tra từ dataset vào engine và từ nhập JSON vào số hiển thị.

E2E có lưu/tải dữ liệu sau reload, JSON export giữ nguyên, giá trị ROE/P/E/FCF, bài DCF tính tay, cập nhật WACC, lưu/khôi phục giả định, g≥WACC bị chặn, thiếu claim không thay 0, EPS âm/thiếu CFO, JSON sai không giữ kết quả cũ, HTML được render như text, median peer và khóa ngân hàng. Kiểm tra chiều rộng 320/390/768/1440 với dữ liệu Engine; suite cũ còn có 1024.

Những lỗi đã tìm và sửa: lịch sử có thể trộn annual hợp nhất/riêng lẻ; CAGR chưa chặn kỳ gốc mâu thuẫn; nguồn FCFF lịch sử thiếu kỳ đầu; P/E/EV có tử số không dương; fixture tỷ lệ cổ phiếu khiến giá/cp khó đọc. Hai E2E ban đầu thất bại do selector `role=alert` trùng route announcer của Next.js; đã chọn đúng vùng lỗi ứng dụng và chạy lại thành công. Không nới assertion để bỏ kiểm tra logic.

Chrome chạy profile kiểm thử riêng. CUA/shell sandbox thường gặp lỗi khởi tạo helper tại môi trường này; các lệnh local được chạy qua cơ chế escalation đã cho phép. Không cần cài dependency hoặc browser mới. Production build chỉ được tạo local, không deploy. Dependency audit đã ghi trong README là lần kiểm tra 09/10/2026 (0 production, 5 high thuộc dev ESLint chain); **không chạy lại audit registry ở Phase 2**, package/lockfile không đổi.

## Chưa triển khai và rủi ro còn lại

1. Không có adapter dữ liệu thật/giấy phép, kiểm toán nguồn, xác minh nội dung citation, OCR/PDF extraction hoặc tự động tạo Verified Data. Schema hợp lệ chỉ chứng minh cấu trúc. Dữ liệu MOCK luôn để luyện tập.
2. Schema định chế tài chính mới là khung; chưa NIM/CAR/NPL đầy đủ, P/B chuyên ngành, residual income hoặc DDM. UI vẫn sáu mã Phase 1, chưa thêm mã hoặc bao phủ HOSE/HNX/UPCoM.
3. DCF có growth/margins cố định trong forecast, chiết khấu về cuối năm cơ sở. Chưa định giá tại một ngày giữa năm, roll-forward, điều chỉnh lease/pension, mô hình lỗ chuyển kỳ, pha loãng/corporate actions hoặc terminal ROIC/reinvestment riêng. Terminal dùng FCFF cuối × (1+g); cần năm cuối ổn định. WACC được người dùng nhập; pure function có sẵn nhưng chưa form CAPM/WACC builder.
4. Chưa TTM, FX, 52/53-week/transition periods, đầy đủ đối chiếu ba báo cáo hay kiểm soát restatement bằng tài liệu. `basis` chỉ so khớp chuỗi do người dùng khai báo. Báo cáo/giá có thể cũ; thời điểm luôn hiển thị, không có bộ đánh giá độ mới tự động.
5. Độ chính xác tính theo IEEE-754 và giới hạn safe magnitude, làm tròn chỉ ở UI. Không thay thế hệ thống sổ cái decimal. Giá trị bridge từ sổ sách có thể khác giá trị kinh tế, tiền bị hạn chế và assets trùng lặp cần đối chiếu.
6. Peer ngành `corporate` là nhóm rộng; chưa tự kiểm tra ngành hẹp, định nghĩa multiple, scope hay thời điểm giá. Median chỉ tổng hợp dữ liệu đã cung cấp. Peer/nguồn gốc multiple chưa nằm trong bundle lưu giả định; nên giữ tệp JSON nguồn riêng. Chưa có thesis/rationale editor cho từng assumption.
7. localStorage không mã hóa, không đồng bộ, khác theo origin/trình duyệt và có thể bị xóa. Lưu/xuất chủ động; chuyển trang mất dữ liệu chưa lưu. Không có backend/database hoặc mô hình tài khoản.
8. Engine chưa tự đính kèm output vào ChatGPT packet. Luồng dùng tài khoản ChatGPT hiện có vẫn là copy/export/import thủ công, ChatGPT xử lý trực tuyến; không có API tính phí. Research Reports/PDF hoàn chỉnh chưa có.
9. Các agent tài chính đã hỗ trợ tham chiếu/audit nhưng chạm quota; root hoàn thành engine và review cuối, agent UI triển khai giao diện. Đây chưa phải xác nhận độc lập của chuyên gia kiểm toán/tài chính.

## Đề xuất Phase 3

1. Export snapshot tài chính gồm version, input lineage, kết quả xác định, assumptions và peer lineage vào hồ sơ ChatGPT; kiểm tra phản hồi không tự thêm/sửa số và source IDs.
2. Tạo regression fixtures từ báo cáo được quyền sử dụng, kiểm tra chéo bằng bảng tính độc lập, thêm financial-domain review trước khi dùng nghiên cứu thực.
3. Mở rộng từng mô hình riêng: TTM và corporate actions; định giá đúng ngày và terminal reinvestment; sau đó bank/residual income/DDM cùng schema/guard/tests tương ứng.
4. Đánh giá adapter Việt Nam, điều kiện cấp phép và xác minh nguồn; chỉ nối nguồn được xác nhận khả dụng. Giữ lựa chọn local/không API trả phí hiện tại.

Commit được chia theo module trên branch đang làm việc; chỉ push branch này, không force-push, merge hay deploy. Xem lịch sử Git để biết SHA phát hành.
