# Ratio Engine — định nghĩa và giới hạn

Mã chuẩn: `src/lib/financial/ratios.ts`; kiểm thử `ratios.test.ts`. Mỗi output gồm `Calculation`, formula, meaning, limitations, input values/source ID/locator/period và provenance. Kết quả không hợp lệ là `value: null` với mã missing_data, not_meaningful, incompatible, unsupported hoặc invalid. UI ghi lý do, không hiển thị 0 thay cho thiếu.

Quy tắc chung: đủ đầu vào hữu hạn; mẫu số chia phải dương; bình quân cần cả số dư đầu/cuối dương (quy tắc thận trọng, có thể khóa cả trường hợp mới thành lập). Âm ở tử số lợi nhuận/CFO/FCF vẫn thể hiện lỗ/dòng tiền âm. Tỷ lệ trả về số thập phân, UI nhân 100; đơn vị times không nhân 100. Các chỉ số theo kỳ, không tự annualize. Chỉ doanh nghiệp phi tài chính được tính.

Trong bảng: `avg(X) = (X đầu kỳ + X cuối kỳ)/2`; `D` = nợ vay ngắn + dài hạn; `E` = vốn thường + NCI + ưu đãi; `IC = E+D−Cash`; `T = incomeTax/pretaxIncome`; `MC = giá × cổ phiếu lưu hành`. Các tên là đầu vào bắt buộc, thiếu bất kỳ thành phần cần dùng thì kết quả thiếu.

| Chỉ số / hàm | Công thức | Ý nghĩa và giới hạn cụ thể |
| --- | --- | --- |
| Gross Margin / grossMargin | Gross Profit / Revenue | Lãi còn lại sau giá vốn; cơ cấu doanh thu/ghi nhận giá vốn có thể khác ngành. |
| Operating Margin / operatingMargin | EBIT / Revenue | Sinh lời hoạt động trước lãi và thuế; cần chuẩn hóa khoản bất thường khi so sánh. |
| Net Profit Margin / netProfitMargin | Net Income tổng / Revenue | Lãi sau thuế trên doanh thu, có thể gồm thu nhập ngoài hoạt động. |
| ROE / roe | Net Income to Common / avg(Common Equity) | Sinh lời cổ đông thường; đòn bẩy làm thay đổi ROE, không trộn lợi nhuận tổng với vốn công ty mẹ. |
| ROA / roa | Net Income tổng / avg(Total Assets) | Hiệu quả tài sản; bị ảnh hưởng cơ cấu vốn và tuổi tài sản. |
| ROIC / roic | EBIT × (1−T) / avg(IC) | Sinh lời vốn đầu tư theo định nghĩa đã chọn; T trong [0,1], LNTT dương. Trừ toàn bộ tiền; chưa tách tiền hoạt động cần thiết và chưa chuẩn hóa thuế. |
| Current Ratio / currentRatio | Current Assets / Current Liabilities | Khả năng trang trải nợ ngắn hạn trên sổ sách; không đo thời điểm thu/chi. |
| Quick Ratio / quickRatio | (Cash + Trade Receivables) / Current Liabilities | Biến thể thận trọng, chưa có short-term investments trong schema; chất lượng phải thu vẫn quan trọng. |
| Cash Ratio / cashRatio | Cash / Current Liabilities | Chỉ tiền và tương đương tiền, không gồm đầu tư ngắn hạn; chưa tách tiền bị hạn chế. |
| Debt-to-Equity / debtToEquity | D / E | Đòn bẩy nợ chịu lãi, không thay D bằng toàn bộ nợ phải trả. |
| Net Debt / netDebt | D − Cash | Âm là tiền ròng theo đầu vào; chưa đánh giá tính khả dụng của tiền. |
| Interest Coverage / interestCoverage | EBIT / Interest Expense | Khả năng trang trải lãi theo lợi nhuận kế toán; lãi bằng 0 thì không meaningful, EBIT âm được giữ. |
| Asset Turnover / assetTurnover | Revenue / avg(Total Assets) | Hiệu suất dùng tài sản; phụ thuộc tính thâm dụng vốn. |
| Inventory Turnover / inventoryTurnover | Cost of Revenue / avg(Inventory) | Tốc độ luân chuyển tồn kho; số dư bình quân hai điểm có thể lệch với mùa vụ. |
| Receivable Days / receivableDays | avg(Receivables) / Revenue × ngày thực tế kỳ | Proxy DSO khi thiếu doanh thu bán chịu; ngày tính kể cả đầu/cuối kỳ, không luôn 365. |
| CFO / Net Income / operatingCashFlowToNetIncome | CFO / Net Income tổng | Khả năng chuyển lợi nhuận thành tiền; lợi nhuận không dương khóa tỷ số. |
| FCF đơn giản / freeCashFlow | CFO − CAPEX | CAPEX chi dương; không phải FCFF/FCFE, chưa điều chỉnh lãi và vay ròng. |
| FCF Margin / fcfMargin | (CFO−CAPEX) / Revenue | Dòng tiền đơn giản trên doanh thu, nhạy chu kỳ đầu tư. |
| Cash Conversion / cashConversion | CFO / (EBIT + D&A) | Định nghĩa trong app là CFO/EBITDA, **không phải** cash conversion cycle CCC. EBITDA phải dương. |
| Revenue Growth / growth | (Revenue kỳ này − cùng kỳ trước) / cùng kỳ trước | Cùng loại kỳ, quý, scope/basis; kỳ gốc không dương thì khóa. |
| Earnings Growth / growth | (NI Common kỳ này − cùng kỳ trước) / cùng kỳ trước | Cùng quy tắc; kỳ này âm vẫn thể hiện suy giảm hơn 100% nếu kỳ trước dương. |
| EPS Growth / growth | (Diluted EPS kỳ này − cùng kỳ trước) / cùng kỳ trước | Cần cùng cơ sở pha loãng/chia tách; không suy từ số cổ phiếu cuối kỳ. |
| Revenue CAGR / cagr | (Revenue cuối / đầu)^(1/số năm) − 1 | Năm đầu dương, năm cuối không âm, số năm dương; chỉ dùng năm cùng scope/basis. Không mô tả đường đi giữa hai điểm. |
| P/E / pe | Giá / Diluted EPS năm | Giá và EPS phải dương; lỗ không phải cổ phiếu “P/E âm rẻ”. |
| P/B / pb | Giá / (Common Equity / Shares) | Vốn thường, cổ phiếu và giá dương; giá trị sổ sách không tương đương giá trị thanh lý. |
| EV/EBITDA / evEbitda | (MC+D+NCI+Preferred+OtherClaims−Cash−NonOperatingAssets) / (EBIT+D&A) | EV và EBITDA phải dương; các khoản bridge phải đầy đủ, không trùng nhau. |
| FCF Yield / fcfYield | (CFO−CAPEX) / MC | MC dương; FCF âm được giữ. Không phải FCFE yield hoặc lợi nhuận cam kết. |

Market multiples dùng năm đầy đủ hoặc TTM được dựng hợp lệ; TTM không có EPS nên P/E bị khóa. Market snapshot cần từ ngày công bố trở đi, cùng basis, có analysisAsOf và không quá 30 ngày; corporate actions qua khoảng báo cáo/số cổ phiếu đến ngày giá cần coverage rõ, sự kiện chưa điều chỉnh khóa kết quả. Không tự cập nhật vốn chủ giữa hai ngày. Nếu kế toán kỳ hiện tại/đầu kỳ/kỳ so sánh mâu thuẫn, tỷ số cần kỳ đó bị khóa. Doanh nghiệp ngân hàng/chứng khoán/bảo hiểm bị khóa toàn bộ 27 tỷ số corporate.

Phase 2.1 giữ nguyên 27 định nghĩa toán học, sửa cách chọn đầu vào: số dư bình quân phải kết thúc ngay trước ngày đầu kỳ và cùng scope/basis. Nhiều bản năm/quý/revision cùng ngày cần openingReportId hợp lệ; không chọn `.find()` tùy thứ tự. So sánh tăng trưởng chỉ dùng một kỳ tương thích duy nhất; thiếu/mơ hồ thì khóa. TTM lấy dòng cộng dồn 12 tháng và số dư cuối cửa sổ, dẫn nguồn mọi toán hạng; EPS, tăng trưởng TTM và CAGR TTM chưa hỗ trợ. Xem [TTM](TTM.md), [data quality](DATA_QUALITY.md) và [bộ kiểm chứng độc lập](../src/lib/financial/fixtures/README.md).

Tham chiếu định nghĩa và các biến thể: [CFA Institute — Financial Ratio List](https://www.cfainstitute.org/sites/default/files/-/media/documents/support/programs/cfa/cfa_program_level_ii_financial_ratio_list.pdf). Các lựa chọn riêng của EquityLens (quick/cash ratio không gồm đầu tư ngắn hạn, ROIC trừ tiền, Cash Conversion=CFO/EBITDA) được công bố rõ ở trên; không nhận là bộ định nghĩa duy nhất.
