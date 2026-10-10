# EquityLens AI — Yêu cầu nghiên cứu một mã cổ phiếu

Ngày rà soát: 09/10/2026. Phạm vi: nghiên cứu cơ bản cổ phiếu Việt Nam, ứng dụng local và tài khoản ChatGPT hiện có. Đây là đặc tả đề xuất; chưa kết nối dữ liệu thật hay chạy định giá thực tế.

## 1. Luồng phù hợp hiện tại

Web local chuẩn hóa hồ sơ, xuất Research Pack để người dùng chủ động gửi vào ChatGPT; sau đó nhập phản hồi về web. Phần tính số bằng hàm xác định là yêu cầu cho Financial Engine tiếp theo, chưa được triển khai trong bản này. Không cần API trả phí. Dữ liệu gửi vào ChatGPT rời khỏi máy local; giao diện phải nói rõ trước khi xuất. Chỉ đưa tài liệu người dùng có quyền sử dụng và chia sẻ.

AI giải thích, so sánh, phản biện và nêu câu hỏi còn thiếu. AI không bổ sung số thiếu bằng trí nhớ, không quyết định độ tin cậy chỉ từ giọng văn và không thực hiện giao dịch.

## 2. Dữ liệu tối thiểu

| Nhóm | Cần thu thập | Thiếu thì giới hạn |
|---|---|---|
| Định danh | Mã, sàn, pháp nhân, ngành, loại doanh nghiệp | Không gộp công ty mẹ/con hoặc mã gần giống |
| Tài chính | Ba báo cáo và thuyết minh; mục tiêu 3–5 năm, các quý mới nhất | Một kỳ chỉ cho mô tả; không kết luận xu hướng dài hạn |
| Phạm vi | Hợp nhất/riêng, kỳ quý/lũy kế/năm, đơn vị, kiểm toán/soát xét, bản điều chỉnh | Chặn so sánh và tính toán khi không tương thích |
| Giá và cổ phiếu | Giá, thời điểm, tiền tệ, số cổ phiếu lưu hành, EPS, cổ tức/chia tách/ESOP | Không định giá tương đối nếu thiếu đầu vào phù hợp |
| Hoạt động | Phân khúc, khách hàng, ngành, lợi thế cạnh tranh, quản trị | Ghi rõ luận điểm chưa có bằng chứng |
| Rủi ro | Ý kiến kiểm toán, bên liên quan, nợ đáo hạn, bảo lãnh, kiện tụng | Không tự suy ra “không có rủi ro” |

Mỗi quan sát cần `value`, `unit`, `periodStart/End`, `scope`, `sourceId`, `locator` (trang/bảng), `publishedAt`, `retrievedAt`, trạng thái kiểm chứng. Lưu phiên bản cũ khi có điều chỉnh. FPT công bố riêng các loại báo cáo và sự kiện vốn: đây là bằng chứng thực tế cho nhu cầu phân biệt kỳ, phạm vi và số cổ phiếu. [Nguồn FPT](https://fpt.com/vi/nha-dau-tu/thong-tin-cong-bo)

## 3. Phương pháp và điều kiện chặn

Các quy tắc dưới đây là thiết kế đề xuất cho sản phẩm, không phải ngưỡng đầu tư áp dụng mọi doanh nghiệp.

| Phương pháp | Quy tắc | Phải chặn kết luận khi |
|---|---|---|
| Tăng trưởng | So cùng kỳ, cùng phạm vi; ghi việc điều chỉnh | Kỳ gốc bằng/âm, thiếu kỳ hoặc thay đổi hợp nhất chưa xử lý |
| ROE/ROA | Lợi nhuận phù hợp chia vốn/tài sản bình quân | Thiếu số đầu kỳ; vốn âm thì ROE không có ý nghĩa thông thường |
| Chất lượng lợi nhuận | Đối chiếu lợi nhuận, CFO, phải thu, tồn kho và khoản bất thường | Chỉ có lợi nhuận mà thiếu dòng tiền/thuyết minh |
| P/E | Giá/EPS tương thích kỳ, pha loãng và corporate actions | EPS không dương hoặc dữ liệu không tương thích |
| P/B | Giá/BVPS cùng cơ sở cổ phiếu, vốn thuộc cổ đông tương ứng | Vốn chủ sở hữu không dương hoặc thiếu số cổ phiếu |
| EV/EBITDA | Công bố thành phần EV, EBITDA và điều chỉnh | Ngân hàng; EBITDA không dương; thiếu nợ/tiền/lợi ích thiểu số |
| DCF–FCFF | Dự báo EBIT, thuế, tái đầu tư; chiết khấu WACC; chuyển EV sang vốn cổ đông | Thiếu đầu vào; WACC ≤ tăng trưởng dài hạn; mô hình không phù hợp ngành |
| So sánh ngành | Cùng mô hình kinh doanh, kỳ, chuẩn số liệu; nêu tiêu chí chọn peer | Chỉ chọn đối thủ có hệ số hỗ trợ kết luận mong muốn |

Định giá cần phù hợp dòng tiền, rủi ro và cách chiết khấu. Không lấy dòng tiền vốn chủ rồi chiết khấu WACC. DCF chỉ là kết quả có điều kiện theo giả định. [Damodaran — Introduction to Valuation](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/background/valintro.htm)

Bear/Base/Bull phải liệt kê tăng trưởng, biên lợi nhuận, tái đầu tư, chi phí vốn và lý do. Hiển thị độ nhạy và tỷ trọng giá trị cuối kỳ. Margin of safety đề xuất tính `(giá trị nội tại − giá)/giá trị nội tại`, chỉ khi giá trị nội tại dương; kết quả luôn gắn kịch bản.

## 4. Ngân hàng là nhánh riêng

Không dùng mặc định CFO−CapEx, EV/EBITDA, nợ ròng hay current ratio như doanh nghiệp phi tài chính. Nợ và tái đầu tư ở tổ chức tài chính có đặc điểm khác; ưu tiên cách nhìn vốn chủ. [Damodaran — Financial service firms](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/littlebook/financialsvccompanies.htm)

Thu thập NII, tài sản sinh lãi bình quân, NIM, CASA, CIR, dư nợ theo nhóm, NPL, dự phòng/bao phủ, chi phí tín dụng, CAR, ROE/ROA, cơ cấu tiền gửi và tập trung tín dụng. Giữ nguyên định nghĩa, phạm vi và căn cứ công bố; không tự tính CAR nếu thiếu tài sản có rủi ro/vốn tự có đúng quy định. P/B kết hợp ROE và chất lượng tài sản là công cụ so sánh; DDM/residual income cần giả định phân phối lợi nhuận và vốn bổ sung.

Báo cáo VCB minh họa các chỉ tiêu ngân hàng và việc điều chỉnh số kỳ trước; nguồn 2024 này dùng kiểm chứng cấu trúc, không đại diện dữ liệu mới nhất. [VCB Annual Report 2024, trang in 20–21 và 208–209](https://www.vietcombank.com.vn/-/media/Project/VCB-Sites/VCB/Nha-Dau-tu/Files/BC-dinh-ky/BC-thuong-nien/2024/EN_VCB-Annual-Report-2024_Full_250426_FN_compressed.pdf)

## 5. Nguồn Việt Nam và giới hạn

| Nguồn | Đã xác minh | Chưa xác minh |
|---|---|---|
| IR doanh nghiệp: FPT, VCB | Có công bố/báo cáo chính thức đã mở | Quyền crawl, lưu hàng loạt, tái phân phối hoặc gửi toàn tài liệu sang AI |
| SSI FastConnect | Tài liệu mô tả Market Data; yêu cầu tài khoản SSI, API key và điều khoản | Quyền tài khoản người dùng; phạm vi dữ liệu/quyền sử dụng thực tế; chưa thử endpoint |
| HNX/HOSE | Ứng viên nguồn chính thức | HNX không mở được bằng công cụ trong lượt này; HOSE chưa đánh giá. Chưa chọn adapter |

Tài liệu SSI nêu hiện chưa thu phí API, nhưng đây không phải bảo đảm quyền truy cập hay cho phép tái sử dụng. Chỉ cân nhắc quyền đọc Market Data sau khi kiểm tra điều khoản; không bật Trading. [SSI — Dịch vụ FastConnect](https://developers.ssi.com.vn/docs/faq/service-overview)

Khởi đầu bằng người dùng nhập số và nguồn hoặc tải tài liệu có quyền sử dụng. Public URL không tự đồng nghĩa giấy phép API. Chưa có nguồn được xác minh thì giữ `mock`, không giả làm giá thị trường.

## 6. Bằng chứng, AI và kiểm thử

Bốn lớp nội dung: **Verified Data** (đã đối chiếu nguồn), **Calculated Metrics** (có công thức và đầu vào), **Analyst Assumptions** (do người dùng chọn), **AI Interpretation** (diễn giải). `mock` là cờ xuất xứ độc lập; không thể chuyển thành Verified. OCR và dữ liệu nhập tay mặc định chưa đối chiếu.

Packet có `packetId`, `symbol`, `asOf`, phiên bản, source IDs, số tính, giả định và phần thiếu. Loại mock khỏi gói nghiên cứu thật; chỉ xuất khi chủ động chọn chế độ luyện tập. Phản hồi ChatGPT phải có claim, lớp nội dung, source/metric IDs và điểm chưa chắc chắn.

Kiểm schema/packet/mã/source ID chỉ chứng minh cấu trúc và tham chiếu tồn tại, **không chứng minh nhận định đúng hoặc nguồn hỗ trợ nhận định**. Import luôn giữ “AI chưa kiểm chứng”; hiển thị nguồn cạnh nhận định để người dùng đối chiếu.

Tài liệu ngoài là dữ liệu không đáng tin: tách khỏi chỉ dẫn; không thực thi lệnh, HTML/script hoặc URL do nội dung/AI yêu cầu; không cấp công cụ bí mật/giao dịch. Prompt đơn thuần không loại bỏ hoàn toàn injection. [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)

Nghiệm thu: chặn số thiếu/NaN/chia 0; phân biệt quý với lũy kế; đối chiếu đơn vị và hợp nhất; không cộng số dư để tạo TTM; xử lý restatement/corporate actions; chặn mô hình sai ngành; từ chối source ID giả, packet khác mã, mock ngầm và chỉ dẫn độc trong tài liệu. Thiếu bằng chứng thì xuất danh sách cần bổ sung, không xuất giá mục tiêu chắc chắn.
