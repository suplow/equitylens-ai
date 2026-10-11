# Bộ kiểm chứng tài chính độc lập — MOCK

Mọi công ty, báo cáo, giá, cổ phiếu và giả định tại đây đều **tự tạo để kiểm thử**, không phải dữ liệu chứng khoán thật. `MOCKSTBL`, `MOCKGROW`, `MOCKDIST` không đại diện doanh nghiệp thực. Không dùng kết quả làm giá mục tiêu.

## Tính độc lập và cách tái lập

`recompute.py` dùng duy nhất thư viện chuẩn Python, `Decimal` với độ chính xác 50 chữ số. Script chứa bảng đầu vào do người kiểm thử thiết kế và các phép tính riêng; không import TypeScript, không gọi Financial Engine, không đọc kết quả chạy ứng dụng, không dùng API. Các giá trị kỳ vọng được lưu sẵn trong JSON dưới dạng chuỗi thập phân, không tính lại bằng engine khi chạy Vitest.

```powershell
python src/lib/financial/fixtures/recompute.py --check
npm test -- src/lib/financial/independent.test.ts
```

`--check` chỉ đọc và kiểm tra khả năng tái tạo chính xác các file. Bỏ `--check` sẽ ghi lại input/scenarios/expected/CSV từ bảng và công thức Python; cần review thay đổi số liệu trước khi chấp nhận. Đổi công thức engine không phải lý do tự động cập nhật expected.

`independent.test.ts` đối chiếu 27 hàm tỷ số trên hai bộ đủ dữ liệu, 27 kết quả theo dataset cho mỗi bộ trong ba bộ, FCFF lịch sử, ba kịch bản, định giá tương đối và 25 ô độ nhạy mỗi bộ. Core goldens kiểm FCFF/WACC/discount/terminal/equity bridge riêng. Chênh lệch cho phép giữa JS double và Decimal: lớn hơn trong `1e-7` tuyệt đối hoặc `1e-12 × |expected|`; không làm tròn tỷ lệ trước khi kiểm tra.

## Ba bộ dữ liệu

| Bộ | Chủ ý kiểm thử |
|---|---|
| `stable` | 2023–2025, lợi nhuận/dòng tiền dương, nhiều đơn vị tiền trong cùng dataset, NCI/ưu đãi/tài sản ngoài hoạt động/claims đều khác 0. Có thêm quý/YTD phục vụ kiểm chứng kỳ. |
| `growth` | Doanh thu tăng 50%, CAPEX và vốn lưu động lớn; FCF/FCFF lịch sử âm nhưng lợi nhuận dương. Bear có equity không dương nên phải bị chặn; Base có FCFF dự phóng năm đầu âm nhưng năm cuối dương. |
| `distressed` | EBIT/EPS/vốn thường âm, phải thu và tài sản ngoài hoạt động thiếu. Tỷ số có mẫu số không hợp lệ bị chặn, `null` không thành 0; một số tỷ số âm vẫn có nghĩa mô tả. |

Dataset theo schema `2.0`; source luôn `mock`. Bảng Python ghi tiền theo **triệu VND**, EPS/giá theo **VND/cổ phiếu**, tỷ lệ dạng thập phân. JSON input chủ động trộn `unit/thousand/million/billion`; expected tiền được chuẩn hóa VND, cổ phiếu là số lượng thực (100.000).

Stable chứa cả FY2024 và Q4/2024 cùng ngày đóng kỳ. `FY2025.openingReportId = FY2024` chỉ định rõ nguồn số dư đầu kỳ, tránh tự chọn một trong nhiều báo cáo. Metadata này không thay đổi số liệu. `analysisAsOf`, `sharesAsOf` và khoảng rà soát corporate actions đều là giả lập: danh sách sự kiện rỗng không phải xác nhận ngoài đời.

## Đối chiếu bằng tay

Các số tiền trong bảng sau đều theo triệu VND, trừ kết quả giá/cổ phiếu của core case.

| Phép tính | Thay số | Kỳ vọng |
|---|---|---|
| Stable ROE | `156 / ((610 + 710) / 2)` | 23,6363636364% |
| Stable ROIC | NOPAT `220 × (1−41,6/208) = 176`; vốn đầu `610+45+15+60+110−110=730`; vốn cuối `710+50+20+70+130−140=840`; `176/785` | 22,4203821656% |
| Stable FCF đơn giản | `210−70` | 140 |
| Stable FCFF lịch sử | `176+50−70−(175−160)` | 141 |
| Growth ROE | `175 / ((560+820)/2)` | 25,3623188406% |
| Growth ROIC | `216 / ((1185+1870)/2)` | 14,1407528642% |
| Growth FCF / FCFF | `140−320`; `216+110−320−(500−300)` | −180 / −194 |
| Growth CAGR 2 năm | `(1350/600)^(1/2)−1` | 50% |
| Core FCFF | `100×(1−20%)+10−20−5` | 65 |
| Core WACC | `12%×75%+6%×(1−20%)×25%` | 10,2% |
| Core TV | `110×(1+0%)/(10%−0%)` | 1.100 |
| Core bridge đầy đủ | `1000+20+40−300−50−25−75` | Equity 610; chia 10 cổ phiếu = 61 |

Core DCF dòng tiền `[100,100]`, WACC 10%, g=0%: giá trị hoạt động bằng `100/10% = 1000`. Bridge `+20−30−5` cho equity 985 và giá/cp 98,5. Với `[100,110]`, phải tính `100/1,1 + 110/1,21 + 1100/1,21 = 1090,9090909`; không nhầm với dòng tiền đều.

## Công thức được kiểm chứng

- Sinh lời: gross/EBIT/net margin chia doanh thu; ROE dùng lợi nhuận thường và vốn thường bình quân; ROA dùng lợi nhuận tổng và tổng tài sản bình quân; ROIC dùng NOPAT/vốn đầu tư bình quân.
- Thanh khoản/đòn bẩy: CA/CL; `(cash+receivables)/CL`; cash/CL; nợ vay/tổng vốn chủ; nợ vay−cash; EBIT/lãi vay.
- Hiệu quả: doanh thu/tài sản bình quân; giá vốn/tồn kho bình quân; phải thu bình quân/doanh thu × số ngày thực tế.
- Dòng tiền: CFO/NI; CFO−CAPEX; FCF/doanh thu; CFO/(EBIT+D&A). FCF đơn giản không được coi là FCFF.
- Tăng trưởng: chênh lệch chia kỳ trước cho doanh thu/lợi nhuận thường/EPS; CAGR giữa hai năm đầu-cuối.
- Thị trường: giá/EPS; giá/(vốn thường/cổ phiếu); EV/(EBIT+D&A); FCF/(giá×cổ phiếu). EV cộng nợ/NCI/ưu đãi/claims, trừ tiền và tài sản ngoài hoạt động.
- Forecast: doanh thu tăng theo giả định; EBIT, D&A, CAPEX và WC theo tỷ lệ doanh thu; FCFF=`NOPAT+D&A−CAPEX−ΔWC`; PV cuối năm; TV Gordon; cộng PV forecast và PV terminal rồi qua bridge.
- Relative: P/E×EPS; P/B×vốn thường; EV/EBITDA×EBITDA rồi qua bridge. Hệ số đều là giả định MOCK. Sensitivity dùng 5 WACC × 5 terminal-growth và chiết khấu lại bằng Python độc lập.

Nguồn phương pháp: [CFA — Free Cash Flow Valuation](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/free-cash-flow-valuation), [CFA — Market-Based Valuation](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/market-based-valuation-price-enterprise-value-multiples). Quy ước cụ thể của ứng dụng vẫn phải được đối chiếu trong [FINANCIAL_FORMULAS.md](../../../../docs/FINANCIAL_FORMULAS.md) và [VALUATION_METHODS.md](../../../../docs/VALUATION_METHODS.md).

## CSV, Excel và kỳ báo cáo

Mở `ratios.expected.csv` bằng **Data → From Text/CSV**, delimiter dấu phẩy, decimal separator dấu chấm. Cột `value_normalized` có 81 kỳ vọng/trạng thái; `blocked_code` giải thích ô không có số. So sánh với công thức nhập độc lập, ví dụ `=156/AVERAGE(610,710)` cho stable ROE. Ô tỷ lệ lưu `0.23636…`, dùng định dạng Percentage để xem 23,636…%. Expected JSON giữ 50 chữ số; Excel có độ chính xác hữu hạn nên không đối chiếu chuỗi toàn bộ chữ số.

`stable.expected.json` có YTD difference và TTM để triển khai kiểm chứng các API kỳ: TTM Q4/2024–Q3/2025 doanh thu 1.075 triệu, CFO 205 triệu, CAPEX 67,5 triệu; tiền cuối kỳ 132,5 triệu. TTM cộng **flow**, giữ **số dư cuối kỳ**, EPS để `null`; không cộng cổ phiếu/bảng cân đối hoặc trừ EPS YTD. H1−Q1 cho doanh thu Q2 là 275 triệu. Sự có mặt của golden không tự chứng minh mọi API TTM đã được test: xem assertion thực tế trong test suite.

## Giới hạn

Bộ này chứng minh số học và quy ước được khai báo, không xác minh báo cáo doanh nghiệp, giấy phép dữ liệu hay độ hợp lý kinh tế của giả định. Các phương pháp giữa Python và engine cùng dựa trên đặc tả; đối chiếu bằng tay giảm rủi ro cùng hiểu sai đặc tả nhưng không thay review tài chính độc lập.

Forecast dùng tỷ lệ cố định và terminal FCFF từ năm cuối; không xây mô hình tái đầu tư/ROIC riêng cho trạng thái ổn định. Dữ liệu giả không thể chứng minh rằng doanh nghiệp đã ổn định. Goldens chủ yếu đối chiếu EV/equity/per-share; không mặc định upside/MOS hợp lệ khi ngày định giá, giá, số cổ phiếu khác nhau. Không bao phủ định chế tài chính, FX, dữ liệu thực hoặc tích hợp AI.
