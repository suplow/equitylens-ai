# Dùng ChatGPT hiện có với EquityLens local

Ngày kiểm chứng: 09/10/2026. Quyết định của người dùng: dùng tài khoản ChatGPT hiện có, không thêm API trả phí; website chỉ chạy local.

## Luồng có thể dùng trong bản này

1. Mở AI Research Analyst cho mã đang nghiên cứu.
2. Nhập câu hỏi; thêm trích đoạn tài liệu, nguồn, ngày công bố, kỳ và vị trí trang/bảng. Nguồn mặc định là `provided_unverified`, không được tự nâng thành Verified.
3. Tạo hồ sơ, đọc danh sách dữ liệu còn thiếu và nội dung sắp xuất. Mặc định không đưa số mock ở dashboard vào hồ sơ. Chỉ bật luyện tập nếu muốn minh họa bằng mock.
4. Sao chép nội dung hoặc tải file `.txt`. Mở ChatGPT, dùng tài khoản hiện có và chủ động dán/đính kèm nội dung. Nút mở ChatGPT không tự gửi dữ liệu và không chuyển nội dung qua URL.
5. ChatGPT nhận prompt có định dạng phản hồi JSON bảy phần. Sao chép JSON trở lại web.
6. Web kiểm tra cấu trúc, mã cổ phiếu, snapshot hồ sơ và ID nguồn. Báo cáo vẫn là **diễn giải chưa đối chiếu nội dung**. Tải hồ sơ/kết quả để lưu trên máy.

Web chuẩn bị và kiểm tra hồ sơ trên máy; **ChatGPT xử lý trực tuyến**, không phải mô hình chạy offline. Người dùng tự chọn tài liệu và thời điểm gửi. Bản local không lưu mật khẩu, cookie hay token ChatGPT và không gọi OpenAI API. Chỉ lưu dữ liệu trong bộ nhớ của trang; tải bản sao trước khi rời trang hoặc reload.

Tài liệu thiếu ngày công bố, đơn vị, phạm vi hoặc thuyết minh phải được nêu là thiếu. Financial Engine chưa được triển khai nên prompt không yêu cầu AI tự tính ratio hoặc giá mục tiêu. Khi chưa có nguồn thật, luồng vẫn giúp lập checklist nghiên cứu nhưng chưa cho một kết luận đầu tư đáng tin.

## Đường tự động hóa có thể đánh giá tiếp

Tài liệu OpenAI xác nhận Codex hỗ trợ đăng nhập bằng ChatGPT cho quyền dùng theo gói, phân biệt với đăng nhập API key tính phí API. Trạng thái kiểm tra tại máy: `codex login status` trả `Not logged in`. Vì vậy không mặc định rằng phiên Codex desktop hiện tại đã cung cấp phiên CLI cho ứng dụng. [OpenAI — Authentication](https://learn.chatgpt.com/docs/auth)

OpenAI cung cấp Codex SDK để điều khiển agent local, còn app-server dành cho client tự quản lý đăng nhập, hội thoại, approvals và stream sự kiện. Đây là hướng tích hợp chính thức có thể đánh giá sau, không phải cào phiên ChatGPT web. Chưa triển khai hoặc kiểm thử đường này trong EquityLens. [OpenAI — Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)

Nếu làm tiếp, cần xác nhận quyền dùng tài khoản, quota, sandbox chỉ cấp công cụ cần thiết, chặn đọc secret/tệp ngoài hồ sơ, giới hạn đầu ra và timeout, cùng kiểm thử injection và kiểm tra nguồn. Không hứa rằng dùng tài khoản có nghĩa là không giới hạn hoặc có mọi model. Không dùng tunnel/deploy chỉ để nối bản local này.

## Giới hạn của kiểm tra phản hồi

- Snapshot ID phát hiện nhầm phiên bản hồ sơ; không phải chữ ký xác thực.
- Source ID tồn tại không chứng minh URL hay nội dung là thật, không chứng minh nguồn hỗ trợ nhận định.
- Prompt yêu cầu không bịa dữ liệu không bảo đảm mô hình luôn tuân thủ. Người dùng vẫn phải đối chiếu số liệu và luận điểm.
- Nội dung import được hiển thị như văn bản React; không thực thi HTML, script, lệnh hoặc công cụ từ báo cáo.
- Tối đa 8 tài liệu, 12.000 ký tự mỗi trích đoạn, 120.000 ký tự JSON phản hồi. Đây là giới hạn ứng dụng, không phải giới hạn của gói ChatGPT.
