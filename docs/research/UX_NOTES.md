# Research workbench — trải nghiệm local với tài khoản ChatGPT

## Quy trình đã chọn

1. **Chuẩn bị hồ sơ**: nhập câu hỏi, giả định riêng và trích đoạn nguồn có tên, ngày công bố nếu biết, kỳ báo cáo, vị trí. URL là tùy chọn; nếu có phải là HTTP/HTTPS. Nguồn nhập tay luôn là `provided_unverified`.
2. **Chuyển sang ChatGPT**: tạo snapshot có mã hồ sơ và nguồn; người dùng xem, copy hoặc tải TXT, mở ChatGPT rồi tự gửi. Không tự gọi API, không gửi dữ liệu qua URL, không đọc cookie/token.
3. **Kiểm tra báo cáo**: dán JSON của ChatGPT, kiểm tra contract, mã hồ sơ/cổ phiếu và mã tham chiếu nguồn. Mỗi claim thể hiện loại thông tin và mở trích đoạn nguồn ngay bên dưới. Tải JSON tự chứa packet, report và warnings để lưu đủ nguồn.

## Tín hiệu độ tin cậy

- Giao diện nói rõ: **Web chạy local · ChatGPT xử lý trực tuyến · Chuyển hồ sơ thủ công**.
- Mặc định không đưa dữ liệu MOCK của dashboard vào packet. Bật chế độ luyện tập mới thêm mock và đánh dấu toàn bộ packet là MOCK.
- Không có nguồn vẫn tạo được hồ sơ hỏi phương pháp/dữ liệu còn thiếu. Không ngầm cho phép định giá hoặc kết luận đầu tư.
- Checklist thể hiện việc cần kiểm tra; số lượng nguồn không được biến thành điểm tin cậy.
- Kết quả import chỉ là **Đã kiểm tra cấu trúc và tham chiếu nguồn**. Không gọi là AI/số liệu đã xác minh; nguồn nhập tay không có huy hiệu Verified.
- Response template ghi rõ **BẢN MẪU TRỐNG**, không hiển thị như câu trả lời AI.
- Mọi nội dung nhập từ AI render bằng React text, không dùng HTML/Markdown không được làm sạch.

## State và dữ liệu

- Đổi câu hỏi, giả định, nguồn hoặc cờ MOCK làm mất hiệu lực packet và báo cáo cũ; cần tạo snapshot mới.
- Đổi mã cổ phiếu remount workbench để tránh nguồn/câu trả lời cũ bị gắn nhầm.
- Bản nháp tài liệu chưa thêm vào danh sách chặn tạo packet; có nút xóa nháp. Đổi bước chuyển focus và cuộn đến nội dung bước để người dùng điện thoại không bị kẹt ở cuối trang.
- Tài liệu/phản hồi nằm trong React state, không localStorage/sessionStorage. Reload/chuyển trang mất phiên; UI chỉ dẫn tải tệp để lưu.
- Clipboard không khả dụng thì hướng dẫn tải TXT hoặc copy preview, không báo thành công giả.
- ChatGPT mở URL tĩnh `https://chatgpt.com/` bằng tab mới `noopener noreferrer`. Tài liệu chỉ rời máy khi người dùng chủ động gửi tại ChatGPT.

## Design và accessibility

Giữ palette navy/charcoal, mint cho hành động và amber cho dữ liệu chưa xác minh. Chữ thân bài 13–14px, thông tin phụ 12px; không chỉ dùng màu thể hiện trạng thái. Form có label, giới hạn độ dài, lỗi và vùng `role=alert/status`. Navigation dùng `aria-current=step`, khóa bước phụ thuộc khi chưa có packet. CSS đặt tiền tố `rw-` và import riêng.

Desktop dùng workspace + thanh chất lượng hồ sơ; <=1050px xếp một cột; <=600px actions xếp dọc và form một cột. Cần kiểm tra 320/390/768/1024/1440px và luồng bàn phím.

## Tình huống cần kiểm thử

- Không có nguồn: packet không chứa tài chính mock nếu chưa tick.
- Thêm/xóa tài liệu hoặc sửa giả định vô hiệu hóa packet cũ.
- Copy thất bại có fallback; download TXT/template/result hoạt động.
- JSON sai/mã hồ sơ sai/nguồn lạ bị từ chối hoặc cảnh báo đúng contract.
- Báo cáo hợp lệ hiện trích dẫn; không gọi kiểm tra cấu trúc là xác minh nội dung.
- HTML/script từ nguồn hoặc AI chỉ hiển thị text.
- Đổi mã/reset/reload không hiển thị nguồn/response sai mã.
