# Valuation Engine — mô hình có điều kiện

Nguồn thực thi: `src/lib/financial/valuation.ts`, `peers.ts`; golden tests trong `valuation.test.ts`, `peers.test.ts` và tích hợp UI trong `tests/financial-engine.spec.ts`. Không có giá mục tiêu tự sinh, xác suất kịch bản hoặc AI tính số. Chỉ nhận dataset đã qua boundary validation.

## FCFF và WACC

`FCFF = EBIT × (1−taxRate) + D&A − CAPEX − ΔOperatingWorkingCapital`.

FCFF là dòng tiền hoạt động cho cả chủ nợ và cổ đông, dùng WACC. Không lấy CFO−CAPEX rồi gắn nhãn FCFF. Tax rate trong [0,1], D&A/CAPEX không âm; EBIT âm với thuế dương bị khóa do chưa có mô hình lỗ chuyển kỳ/hoàn thuế. FCFF âm trung gian có thể hợp lệ; FCFF năm cuối phải dương cho Gordon Growth.

FCFF lịch sử dùng thuế hiệu dụng (thuế/LNTT dương), D&A, CAPEX và chênh lệch WC đầu-cuối kỳ cùng scope/basis. Thiếu một đầu vào thì hiện thiếu. Nó là thông tin đối chiếu; forecast tính từ các giả định tách biệt, không suy giá trị thiếu từ lịch sử.

Hàm `calculateWacc(Ke, Kd, T, equityWeight)` tính `Ke×E/(D+E) + Kd×(1−T)×D/(D+E)`. Chi phí/tỷ trọng vốn phải phù hợp FCFF, cùng currency và cơ sở nominal/real. UI hiện nhập **WACC tổng** do người phân tích ước lượng; chưa có form CAPM, beta, risk-free, ERP hay thị giá nợ. Không tự tạo các tham số này. Hàm WACC được kiểm thử nhưng không xác minh giả định của người dùng.

## Dự phóng và chiết khấu

Mỗi Bear/Base/Bull có 1–10 năm và các tỷ lệ cố định trong kỳ forecast: tăng doanh thu, biên EBIT, thuế, D&A/doanh thu, CAPEX/doanh thu, WC/doanh thu, WACC và terminal growth.

```text
Revenue[t] = Revenue[t−1] × (1+growth)
EBIT[t] = Revenue[t] × ebitMargin
NOPAT[t] = EBIT[t] × (1−taxRate)
D&A[t] = Revenue[t] × depreciationRate
CAPEX[t] = Revenue[t] × capexRate
WC[t] = Revenue[t] × workingCapitalRate
ΔWC[t] = WC[t] − WC[t−1]
FCFF[t] = NOPAT[t] + D&A[t] − CAPEX[t] − ΔWC[t]
DF[t] = 1/(1+WACC)^t
PV forecast = Σ FCFF[t] × DF[t]
TV[N] = FCFF[N] × (1+g)/(WACC−g)
PV terminal = TV[N] × DF[N]
EV = PV forecast + PV terminal
```

Điều kiện: doanh thu cơ sở dương; growth trong (−100%,200%]; biên EBIT, thuế, D&A/doanh thu, CAPEX/doanh thu trong [0,100%]; WC/doanh thu trong [−100%,100%]; 0 < WACC ≤ 100%; −100% < g < WACC. Đây là miền mô hình hiện tại, không khẳng định mọi giả định trong miền đều hợp lý. Terminal g âm được chấp nhận nhưng cần luận cứ. Mọi kết quả phải hữu hạn/trong phạm vi số an toàn.

Chiết khấu **cuối năm từ cuối kỳ cơ sở**, chưa dùng mid-year, stub period hay roll-forward dòng tiền đến market as-of. Market snapshot chỉ làm giá so sánh và số cổ phiếu, không đổi ngày định giá của mô hình. Người dùng phải xem chênh lệch thời gian; cần model khác nếu định giá tại một ngày giữa năm.

Terminal cash flow được giả định tăng trực tiếp từ năm cuối. Chưa mô hình hóa chuyển tiếp ROIC/tái đầu tư hay tính lại CAPEX/WC riêng theo tăng trưởng dài hạn. Người dùng phải bảo đảm FCFF năm cuối đã đại diện trạng thái ổn định; tránh dùng cho doanh nghiệp còn chuyển đổi hoặc có tăng trưởng không bền vững. Tỷ trọng PV terminal >75% EV tạo cảnh báo; ngưỡng này là chính sách hiển thị, không phải tiêu chuẩn đầu tư.

## Equity bridge và per-share

```text
Common Equity Value = EV + Cash + NonOperatingAssets
                     − ShortDebt − LongDebt − NCI − PreferredEquity − OtherClaims
Intrinsic Value / Share = Common Equity Value / SharesOutstanding
Upside = (Intrinsic − ReferencePrice) / ReferencePrice
Margin of Safety = (Intrinsic − ReferencePrice) / Intrinsic
```

Tất cả khoản bridge phải nhập rõ, kể cả 0; cổ phiếu lưu hành >0. Không làm tròn equity âm về 0; equity ≤0 là not meaningful và khóa giá/cp/MOS. Tiền không được cộng trùng tài sản ngoài hoạt động. Các khoản NCI/preferred/claims cần người dùng ước lượng giá trị phù hợp; số kế toán có thể khác giá trị kinh tế. Chưa dự phóng pha loãng hay điều chỉnh corporate actions.

Giá tham chiếu có thể null: giá trị nội tại vẫn tính nếu đủ đầu vào, upside/MOS là null. Không gọi biên an toàn là lợi nhuận kỳ vọng. Không gán xác suất hoặc bảo đảm giá thị trường sẽ đạt kết quả.

## Relative valuation và peer

- P/E: giá/cp = EPS pha loãng năm × hệ số; equity suy ra bằng giá/cp × cổ phiếu hiện tại, khác với mẫu số EPS bình quân pha loãng. EPS không dương thì khóa.
- P/B: equity = vốn cổ đông thường × hệ số; chia cổ phiếu hiện tại. Vốn thường không dương thì khóa.
- EV/EBITDA: EV = (EBIT + D&A) × hệ số; qua cùng equity bridge. EBITDA không dương thì khóa.
- Hệ số phải dương, là giả định do người dùng cung cấp. `peerMedian` chỉ tổng hợp đầu vào có nguồn, báo số mẫu hợp lệ; không tự suy hệ số thiếu hoặc đánh giá premium/discount. Khác biệt quy mô, tăng trưởng, biên lợi nhuận và cơ cấu vốn được ghi trong peer JSON.

Sensitivity gồm 5×5 tổ hợp WACC (±1/2 điểm %) và g (±0,5/1 điểm %) quanh kịch bản đang chọn. Mỗi ô chạy cùng `evaluateScenario`; ô không thỏa điều kiện bị khóa, không clamp WACC/g để cho ra số. Ô trung tâm phải trùng kết quả chính.

## Ngành và giới hạn

Ngân hàng, chứng khoán và bảo hiểm có schema khác và **khóa mọi định giá hiện tại**. Phase sau cần dữ liệu vốn điều tiết, lợi nhuận vốn chủ, payout, cost of equity và giới hạn tăng trưởng trước khi triển khai residual income/DDM/P/B chuyên ngành. Cơ sở lựa chọn: [Aswath Damodaran — Valuing Financial Service Firms](https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/finfirm09.pdf).

Dữ liệu do người dùng cung cấp chưa được xác minh; input qua schema không biến thành Verified Data. Preset MOCK chỉ minh họa phép tính, không thể dùng để khuyến nghị FPT hay mã gắn trên trang. Đọc thêm [quy ước dữ liệu](FINANCIAL_DATA.md) và [ratio definitions](FINANCIAL_FORMULAS.md).
