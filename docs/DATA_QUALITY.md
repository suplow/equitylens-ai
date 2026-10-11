# Data Quality — Phase 2.1

`assessDataQuality(dataset, { reportId?, asOf? })` tạo báo cáo chẩn đoán xác định, chạy local trong `src/lib/financial/quality.ts`. Dữ liệu nhập vẫn phải đi qua `parseFinancialDataset`. Lớp chất lượng không tải URL, kiểm chứng tài liệu, đưa ra khuyến nghị hoặc gán nhãn VERIFIED.

## Nguồn và lớp nội dung

| Nhãn | Ý nghĩa |
| --- | --- |
| `MOCK` | Đầu vào luyện tập; kết quả có sử dụng đầu vào này tiếp tục mang nguồn MOCK. |
| `USER_SUPPLIED_UNVERIFIED` | Người dùng cung cấp; chưa đối chiếu nguồn gốc, kể cả khi khai báo báo cáo đã kiểm toán. |
| `CALCULATED` | Kết quả công thức xác định từ các đầu vào đã nêu. |
| `ASSUMPTION` | Giả định do người phân tích lựa chọn. |
| `AI_INTERPRETATION` | Diễn giải cần kiểm tra lại nguồn và lập luận. |

Nguồn và lớp nội dung là hai thuộc tính độc lập. Danh mục nhãn không chứng tỏ mọi lớp đều có dữ liệu trong báo cáo; module này không sinh giả định hay nội dung AI. `verification` luôn là `not_performed`. Kiểm tra Zod thành công hoặc phương trình khớp không xác minh tính đúng của đầu vào.

## Kết quả trả về

- `fieldLineage`: đường dẫn trường, số gốc, thang đơn vị, số chuẩn hóa, tiền tệ, nguồn và vị trí trích dẫn; kèm kỳ, phạm vi, ngày công bố, basis, `restatement` và `openingReportId` nếu được khai báo. Số cổ phiếu có dimension riêng và không mang tiền tệ. Nguồn không tồn tại hoặc ID nguồn bị lặp được đánh dấu chưa giải quyết, không tự chọn nguồn.
- `missingInputs`: trường còn null hoặc thiếu snapshot thị trường; không thay bằng 0.
- `unavailableMetrics`: kết quả không tính được cùng lý do từ Ratio Engine. Lỗi cấu trúc như trùng ID, trùng kỳ/revision hoặc giá trị không an toàn làm khóa toàn bộ phép tính trong báo cáo chất lượng. Phiên bản điều chỉnh khác revision chỉ tạo cảnh báo; từng công thức tự kiểm tra các kỳ cần dùng.
- `issues`: phát hiện có mức `info`, `warning` hoặc `error`, kèm đường dẫn và ID kỳ liên quan. Không có điểm chất lượng tổng hợp dễ bị hiểu nhầm là chứng nhận.
- `cashReconciliations`: phép đối chiếu tiền đã thực hiện hoặc lý do bỏ qua; giữ null khi thiếu đầu vào hay chưa xác định số dư đầu kỳ.

## Phiên bản điều chỉnh và lựa chọn đầu kỳ

Khóa nhận dạng kỳ là loại kỳ, ngày bắt đầu, ngày kết thúc và phạm vi báo cáo. Cùng khóa nhưng **khác** `restatement.revision` được phép tồn tại như schema nhập; thiếu revision dùng giá trị `original`. Cùng khóa và cùng revision là lỗi trùng kỳ. Nhiều revision luôn có cảnh báo yêu cầu người dùng đối chiếu; không ưu tiên bản theo thứ tự mảng, nhãn “restated” hoặc ngày công bố.

Đối chiếu tiền dùng chung `resolveOpening` với Ratio Engine. Nếu có `openingReportId`, bản được chọn phải có ngày cuối ngay trước đầu kỳ hiện tại, cùng scope/basis và lịch tài chính hợp lệ. Lựa chọn không hợp lệ dẫn tới `invalid_opening_selection`, không âm thầm dùng bản khác. Khi không chọn và có nhiều ứng viên, phép đối chiếu bị bỏ qua vì `ambiguous_opening_balance`.

Một lựa chọn đầu kỳ hợp lệ không tự giải quyết kỳ tăng trưởng hoặc lịch sử CAGR. Vì vậy ROE có thể tính được trong khi tăng trưởng vẫn bị khóa do nhiều phiên bản cùng kỳ trước. Metadata điều chỉnh được sao chép vào lineage; chỉnh sửa output không làm thay đổi dataset đầu vào. Các nhãn status/revision/note vẫn là khai báo chưa xác minh; schema chưa mô tả tác động điều chỉnh theo từng chỉ tiêu hoặc chuỗi thay thế phiên bản.

## Đối chiếu và giới hạn

Module kiểm tra nguồn/ID/kỳ bị trùng, lịch tài chính, thời điểm công bố/truy cập, basis, đơn vị và các quan hệ kế toán hiện có. Thang nghìn/triệu/tỷ được chuẩn hóa; thay thang đo giữa các kỳ tạo lưu ý, không mặc định là lỗi. Không tự chuyển đổi tiền tệ. `asOf` chỉ dùng khi caller cung cấp; không dựa vào đồng hồ hệ thống.

Đối chiếu tiền tính `tiền cuối − tiền đầu − (CFO + CFI + CFF)` với dung sai theo độ làm tròn của các trường. Dư sai khác chỉ là **warning**, vì schema chưa có ảnh hưởng tỷ giá hoặc tái phân loại; khớp cũng không chứng minh số liệu đúng. Nguyên tắc này tham chiếu [IAS 7, đoạn 28](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2021/issued/part-a/ias-7-statement-of-cash-flows.pdf), nơi ảnh hưởng tỷ giá được trình bày để đối chiếu tiền đầu và cuối kỳ. Đây là tham chiếu thiết kế, không khẳng định mọi doanh nghiệp Việt Nam áp dụng IFRS.

Chạy hồi quy: `npm test -- src/lib/financial/quality.test.ts`. Các ca kiểm tra bao gồm nguồn MOCK/user nhập, null, đơn vị, công bố, nhiều revision, đảo thứ tự báo cáo, chọn đầu kỳ hợp lệ và sai ngày/scope/basis, dòng quý so với YTD, cùng các dư sai khác tiền chỉ phát cảnh báo.
