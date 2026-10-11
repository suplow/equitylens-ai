# Phase 2.1 — Financial Validation, Accuracy & Reliability

Ngày nghiệm thu local: 11/10/2026. Nhánh: `feature/equitylens-financial-validation`.

Financial baseline: `87eb4fdd88945a9edb8b6c5ff97dd6a50fd34bf5`. Trước thay đổi Phase 2.1: `355357b55c8539f8ac3157fb5db8e7381f742a62` (bao gồm orchestrator đã hoàn tất). Không xây lại project hoặc merge vào foundation/main.

## Các lỗi đã xác minh và sửa

1. Số dư đầu kỳ dùng `.find()` có thể chọn FY hoặc Q4 khác nhau khi đảo thứ tự JSON. Regression test tái hiện ROE/FCFF phụ thuộc thứ tự. Nay cần ứng viên duy nhất hoặc `openingReportId` đúng ngày/scope/basis/lịch tài chính.
2. DCF chiết khấu về cuối năm cơ sở nhưng từng báo upside/MOS với giá ở ngày khác. Nay giữ giá trị hồi cứu và khóa so sánh khác ngày; số cổ phiếu khác ngày khóa per-share. Không tự roll-forward.
3. Gọi trực tiếp YTD conversion với fiscal label đúng nhưng ngày sai vẫn được chấp nhận. Nay kiểm tra lịch và tính liên tục; không trừ EPS YTD.
4. Lịch sử/tăng trưởng có thể chọn báo cáo trùng kỳ theo thứ tự. Nay chỉ dùng kỳ tương thích duy nhất; lịch sử gắn với kỳ được chọn.
5. Review tích hợp tái hiện quality report khóa cả 27 chỉ số của bộ dữ liệu có revision hợp lệ, dù Ratio Engine tính đúng khi có openingReportId. Nay duplicate key khớp schema, nhiều revision là cảnh báo, và cash reconciliation dùng cùng bộ chọn số dư với engine. Có regression cho đảo thứ tự và ID sai.
6. Khi bổ sung selector, YTD preview riêng bị mất đường truy cập và vẫn có `.find()` chọn tùy tiện bản YTD trước. E2E tái hiện; đã khôi phục lựa chọn YTD và khóa preview khi nhiều phiên bản cùng scope/basis.
7. Kiểm thử direct-call tái hiện ngày phân tích không tồn tại vẫn vào valuation và FCFF lịch sử không kiểm tra mâu thuẫn kế toán kỳ hiện tại. Đã bổ sung guard; regression đạt sau sửa.

Không coi nhận xét review là bug trước khi kiểm chứng. Các lần test đỏ được dùng để sửa hành vi; không bỏ test hay hạ dung sai để đạt PASS.

## Các module đã triển khai

| Module | Kết quả |
| --- | --- |
| A — Period integrity | `periods.ts`, lịch năm tài chính khác tháng 12, kỳ so sánh duy nhất, metadata restatement và explicit opening selection. |
| B — Dates | `dates.ts`, phân biệt report/publication/valuation/price/share/analysis dates; khóa giá tương lai, giá cũ hơn 30 ngày và corporate actions chưa điều chỉnh. |
| C — Quality | `quality.ts`, nguồn từng chỉ tiêu, thiếu dữ liệu/đơn vị/kỳ/nguồn, accounting consistency, cash residual, revision lineage; không tự cân bảng hay gắn VERIFIED. |
| D — TTM | Bốn quý liên tiếp hoặc FY + YTD hiện tại − YTD cùng kỳ trước; chuẩn hóa đơn vị, giữ số dư cuối cửa sổ, lineage mọi toán hạng, EPS null. |
| E — Verification | Ba bộ số liệu MOCK độc lập: ổn định, tăng trưởng CAPEX lớn, thiếu dữ liệu/lợi nhuận âm/các quyền đòi phức tạp. Decimal 50 chữ số độc lập với TypeScript engine; CSV hỗ trợ đối chiếu bảng tính. |
| F — DCF reliability | Cảnh báo terminal contribution, giải thích stable state từng kịch bản, kiểm tra dấu tái đầu tư; sensitivity growth/margin/CAPEX và ma trận WACC/g. |
| G — UI | Annual/Quarterly/YTD/TTM, Data Quality Panel, source lineage, cảnh báo ngày, công thức/đầu vào/lý do khóa, giả định terminal và độ nhạy vận hành. Giữ Phase 1 demo và luồng ChatGPT thủ công. |

JSON tiếp tục strict validation, giới hạn 40 kỳ/50 nguồn, tối đa 1.000.000 ký tự và file UI 1 MiB. Không chạy biểu thức từ JSON, không tải URL nguồn, không thêm dependency hoặc dịch vụ trả phí. Dữ liệu local của người dùng không bị xóa.

## Công thức và phương pháp

27 công thức tỷ số giữ định nghĩa trong [FINANCIAL_FORMULAS.md](FINANCIAL_FORMULAS.md); thay đổi chủ yếu ở việc chọn đúng đầu vào và khóa trường hợp không phù hợp. Bình quân = (số dư đầu + cuối)/2, không lấy cuối kỳ thay số thiếu. TTM cộng dòng theo kỳ nhưng không cộng số dư và không cộng/trừ EPS.

FCFF = EBIT × (1−T) + D&A − CAPEX − ΔWC. WACC = Ke×wE + Kd×(1−T)×(1−wE). Chiết khấu cuối năm: DF[t] = (1+WACC)^−t; TV = FCFF[N]×(1+g)/(WACC−g), với g < WACC. EV = tổng PV forecast + PV terminal. Common equity = EV + cash + non-operating assets − debt − NCI − preferred − other claims; per-share chỉ dùng cổ phiếu đúng ngày định giá.

P/E, P/B, EV/EBITDA giữ hệ số là giả định có điều kiện, không tạo peer group. Upside và MOS chỉ có khi ngày so sánh tương thích. Không gán xác suất Bear/Base/Bull. Chi tiết tại [VALUATION_METHODS.md](VALUATION_METHODS.md), [TTM.md](TTM.md), [DATA_QUALITY.md](DATA_QUALITY.md) và [fixtures/README.md](../src/lib/financial/fixtures/README.md).

## Kết quả kiểm thử thực tế

Môi trường Windows, Node 25.2.1/npm 11.6.2; Playwright dùng Chrome đã cài với `PLAYWRIGHT_CHANNEL=chrome`.

| Lệnh | Kết quả |
| --- | --- |
| `npm run lint` | PASS, không lỗi/cảnh báo ESLint. |
| `npm run typecheck` | PASS. |
| `npm test` | PASS: 282 tests, 11 files. |
| `npm run build` | PASS: 34 trang static. |
| `npm run test:e2e` | PASS: 19 tests, 35,1 giây. |
| `python src/lib/financial/fixtures/recompute.py --check` | PASS: 3 bộ MOCK, 81 tỷ số, 9 kịch bản, 75 ô sensitivity, core/YTD/TTM. |
| Regression cuối `integrity.test.ts` | PASS: 9 tests, sau điều chỉnh câu giải thích market guard. |

E2E giữ kiểm tra Phase 1/research, responsive và import/export/local restore; bổ sung TTM 40% gross margin từ số độc lập, provenance, EPS bị khóa, YTD nhiều revision, ngày số cổ phiếu sai vẫn giữ EV nhưng khóa per-share. Assertion upside 27,50%/MOS 21,57% cũ đã thay bằng khóa đúng ngày, vẫn giữ EV 1,68 tỷ và giá trị hồi cứu 15.300 VND/cp của bài tính tay. Không nới assertion tính toán.

Hai lỗi kiểm thử trong quá trình tích hợp đã được xử lý: selector YTD chưa có và locator nguồn TTM trùng nhiều vùng; locator nay giới hạn đúng panel, không dùng phần tử tùy ý. Fixture generator từng lệch thứ tự key openingReportId; sửa serialization, không thay numeric goldens. Không có lỗi môi trường ngăn bộ kiểm tra cuối. Cảnh báo NO_COLOR/FORCE_COLOR của runner không phải lỗi ứng dụng.

## Giới hạn và việc chưa giải quyết

- Nguồn vẫn MOCK hoặc USER_SUPPLIED_UNVERIFIED. Không xác thực báo cáo gốc, nội dung URL, kiểm toán, revision hoặc corporate-action coverage. Zod và đẳng thức kế toán không chứng minh sự thật.
- Valuation là hồi cứu cuối năm, có thể dùng báo cáo công bố sau đó; không phải backtest thông tin tại thời điểm giao dịch. Chưa roll-forward, stub/mid-year, FX, dự phóng dilution hay điều chỉnh sự kiện vốn. So sánh không đủ điều kiện bị khóa.
- 30 ngày stale price và 75% terminal contribution là chính sách cảnh báo của ứng dụng, không là chuẩn đầu tư. Cash reconciliation chưa có FX/reclassification nên residual chỉ cảnh báo.
- Stable state do người dùng xác nhận; chưa giải terminal ROIC/reinvestment hoặc chuyển tiếp tăng trưởng. Cảnh báo dấu tái đầu tư không bảo đảm toàn bộ giả định nhất quán. Không tự ước lượng WACC/beta/risk-free/ERP.
- Chưa EPS/growth/CAGR TTM, DCF từ TTM, lịch 52/53 tuần hoặc thay đổi năm tài chính. TTM nội bộ dùng metadata derived; không lưu như một báo cáo FY thật. Nhiều revision trong toán hạng TTM cần giải quyết ở bộ dữ liệu nghiên cứu, không tự chọn.
- Ngân hàng, chứng khoán, bảo hiểm vẫn khóa tỷ số/định giá corporate. Chưa mô hình chuyên ngành, thêm mã ngoài danh mục UI, API dữ liệu có giấy phép hoặc PDF extraction đã kiểm chứng.
- Engine dùng IEEE-754 có kiểm tra hữu hạn/phạm vi; không thay ledger kế toán Decimal. Fixtures độc lập xác minh số học theo định nghĩa công bố, không xác minh độ đúng kinh tế của mọi input.
- Chưa tự gắn output Engine vào packet ChatGPT hoặc tự động gửi ChatGPT. Tiếp tục dùng tài khoản ChatGPT qua luồng thủ công; không cần OpenAI API trả phí.
- Ảnh QA và checkpoint runtime có thay đổi local riêng, được giữ lại ngoài commit Phase 2.1. Không đưa dữ liệu người dùng/secret lên Git. Không deploy, force-push hoặc merge.

## Git và khả năng tiếp tục Phase 3

Các commit đã push lên GitHub nhánh `feature/equitylens-financial-validation`:

- `8e3575b`: period/date guards và độ tin cậy valuation.
- `af9ee3d`: quality diagnostics và TTM.
- `d05141c`: fixtures/checks số học độc lập.
- `3ee6a3ae17d4ffa559ef96a69aa7d2f3525c5391`: UI và integration tests — mốc code để reviewer kiểm tra.

Báo cáo này được lưu bằng commit tài liệu tiếp theo. Repo: [suplow/equitylens-ai](https://github.com/suplow/equitylens-ai/tree/feature/equitylens-financial-validation).

Đủ điều kiện làm đầu vào thiết kế Phase 3: tỷ số với lineage, TTM có phương pháp/nguồn, kết quả scenario với ngày/giả định/lý do khóa, và quality report không gán verified. Đề xuất bước kế tiếp là chuyển những output này thành evidence packet chỉ đọc, kiểm tra citation/schema, phân biệt dữ kiện–giả định–diễn giải và kiểm thử prompt injection trước khi nối AI. Phase 3–5 chưa được khởi chạy hoặc phê duyệt tự động trong lượt này.
