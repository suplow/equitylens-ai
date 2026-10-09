# EquityLens AI — cầu nối từ nghiên cứu đến sản phẩm

Ngày chốt: 09/10/2026. Website localhost nghiên cứu cơ bản cổ phiếu Việt Nam, dùng tài khoản ChatGPT hiện có. Đây là yêu cầu sản phẩm, không phải tuyên bố hoàn thành mọi chức năng.

## 1. Quyết định triển khai

Luồng đợt này là **chuẩn bị hồ sơ tại local → người dùng chuyển sang ChatGPT → nhập phản hồi về local**. Website không tự gọi API có phí, không đọc cookie hoặc phiên đăng nhập ChatGPT, không đặt lệnh và không deploy. Website chạy local; ChatGPT xử lý trực tuyến khi người dùng chủ động gửi nội dung. Tài khoản ChatGPT không được giả định là khóa API.

Mục tiêu là biết đã gửi dữ liệu nào, câu trả lời thuộc mã nào, nguồn được dẫn và phần còn thiếu. Thiếu dữ liệu đáng tin thì trả checklist, không kết luận đầu tư.

## 2. Hiện trạng và ranh giới

Provider có sáu mã mock, bốn năm 2022–2025 và ba bảng rút gọn. Giá là VND; tài chính/vốn hóa là tỷ VND. P/E, P/B, ROE là fixture độc lập. Thiếu tài liệu gốc, thuyết minh, trang nguồn, ngày công bố, phạm vi báo cáo và dữ liệu chuyên ngành.

Mặc định **loại toàn bộ số mock khỏi hồ sơ nghiên cứu thực**. Người dùng có thể bật “Luyện tập bằng dữ liệu minh họa”; khi đó packet, prompt và phản hồi luôn mang nhãn MOCK. Bật chế độ này không xác minh dữ liệu và không cho phép đưa ra giá mục tiêu cho doanh nghiệp thực.

## 3. Luồng giao diện

1. **Chuẩn bị:** giữ mã đang xem, nhập câu hỏi, chọn nghiên cứu hoặc luyện tập. Hiển thị nguồn, mốc dữ liệu, khoảng trống và checklist ngành. Chưa có nguồn thì yêu cầu thu thập dữ liệu.
2. **Chuyển sang ChatGPT:** xem trước hồ sơ và hướng dẫn; sao chép hoặc tải file. Nêu rõ thao tác mở ChatGPT không tự gửi hồ sơ. Nội dung gửi chứa dữ liệu, câu hỏi, giới hạn, cấu trúc phản hồi và yêu cầu dẫn source ID.
3. **Nhập phản hồi:** dán JSON; kiểm tra rồi hiển thị báo cáo hoặc lỗi. Thay đầu vào phải tạo snapshot mới; báo cáo cũ không gắn vào hồ sơ mới.

Ba bước sử dụng được bằng bàn phím và trên điện thoại. Trạng thái sao chép/tải/kiểm tra phải rõ; lỗi không được xóa nội dung người dùng vừa nhập.

## 4. Hợp đồng dữ liệu

Contract đợt này tại `src/lib/research/types.ts`: packet chứa `version`, `id`, `symbol`, `company`, `industryTemplate`, `mode`, `question`, `assumptions`, `sources`, `missingData`, `checklist`. Mode là `provided_only` hoặc `mock_practice`. Source chứa `id`, `title`, `url`, `publishedAt`, `period`, `locator`, `content`; trạng thái `provided_unverified` hoặc `mock`.

Khi mở rộng dữ liệu thực, cần thêm ngày truy cập/chốt dữ liệu, kỳ/loại kỳ, đơn vị, phạm vi báo cáo và source ID ở từng dữ kiện. Hiện các thông tin này cần ghi rõ trong nội dung nguồn hoặc danh sách thiếu. Giá trị thiếu giữ `null` và lý do; không chuyển thành 0.

Phân biệt **Verified Data, Calculated Metrics, Analyst Assumptions, AI Interpretation**; cờ MOCK tồn tại độc lập và truyền sang mọi kết quả dẫn xuất. Chỉ số tính toán cần công thức, đầu vào và nguồn. Chữ “Verified” chỉ dùng sau đối chiếu dữ liệu gốc, không được suy ra từ việc có một URL. Thông tin bổ sung do người dùng nhập chưa mặc nhiên đáng tin.

Phản hồi mang đúng `packetId`, `symbol`, `mode`, có `summary`, `limitations` và bảy phần: Executive Summary, Business Overview, Financial Performance, Valuation, Investment Thesis, Key Risks, Bull / Bear Case. Claim gồm `text`, `sourceIds` và category `source_fact`, `interpretation`, `assumption` hoặc `missing_data`; `source_fact` không đồng nghĩa Verified. Tài liệu ngoài không được thay hướng dẫn hệ thống hoặc thực thi HTML/script.

## 5. Chuyển nghiên cứu tài chính thành giao diện

Checklist thông thường gồm ba báo cáo và thuyết minh nhiều năm, quý gần nhất, hợp nhất/riêng lẻ, kiểm toán/soát xét, số liệu điều chỉnh, giá và số cổ phiếu cùng ngày, cổ tức/chia tách, ngành và doanh nghiệp so sánh.

Ngân hàng có checklist riêng: NIM, NPL, dự phòng/bao phủ nợ xấu, CASA, CIR, CAR, ROE và cơ cấu tín dụng. Không tự tính CAR khi thiếu tài sản có rủi ro; không mặc định FCFF hoặc EV/EBITDA. Định giá chỉ mở khi đầu vào và giả định phù hợp; trường thiếu phải nêu lý do chưa thể tính.

Nguồn chuyên môn: [AI_EQUITY_REQUIREMENTS.md](./AI_EQUITY_REQUIREMENTS.md). Tài liệu mô tả API không chứng minh quyền lưu trữ hoặc gửi dữ liệu sang AI.

## 6. Tiêu chí nghiệm thu

- Chế độ mặc định không xuất số mock; chế độ luyện tập thể hiện MOCK trong hồ sơ, prompt và kết quả.
- JSON sai cấu trúc, khác snapshot/mã hoặc dẫn source ID không có phải bị chặn kèm lỗi đọc được.
- Kiểm tra thành công chỉ có nghĩa đúng cấu trúc và tham chiếu thuộc hồ sơ; nhãn kết quả phải ghi **“Diễn giải AI — chưa đối chiếu nội dung”**. Không gọi đây là xác minh sự thật, số liệu hoặc quan hệ hỗ trợ giữa nguồn và nhận định.
- Prompt yêu cầu không tạo số thiếu hoặc kết luận chắc chắn khi thiếu nguồn/kỳ/đơn vị. Import hiện không bảo đảm AI tuân thủ; engine tương lai phải chặn phép tính thiếu đầu vào và mô hình sai ngành.
- Không có request AI tự động, bí mật phía client, tự gửi nội dung sang ChatGPT hoặc yêu cầu thanh toán.
- Kiểm thử bao phủ xuất packet, thay mã/chế độ, import sai và hợp lệ, nguồn lạ, giữ nhãn mock, bàn phím/mobile; lint, typecheck và build đạt trước bàn giao.
