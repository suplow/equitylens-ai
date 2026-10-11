# TTM — số liệu 12 tháng gần nhất

`src/lib/financial/ttm.ts` tính TTM bằng hàm xác định từ báo cáo đã nhập. Mô-đun không gọi AI, API thị trường hoặc tự điền số thiếu. TTM là **Calculated Metrics**, không phải một báo cáo năm mới do doanh nghiệp công bố. Có đầu vào MOCK thì kết quả tiếp tục mang nhãn MOCK.

## Contract hiện tại

```ts
buildTtm(
  data: FinancialDataset,
  anchorId: string,
  method: "quarters" | "fy_ytd",
): Calculation<TtmOutput>

interface TtmOutput {
  report: CorporateReport;
  inputs: InputEvidence[];
  method: string;
  reportIds: string[];
  source: FinancialSource;
}
```

`anchorId` xác định kỳ cuối cùng của cửa sổ TTM. `method` trong kết quả là mô tả phép tính, có ID các báo cáo tham gia. Hàm không thay đổi dataset gốc. Chỉ bộ dữ liệu `industry: "corporate"` được hỗ trợ; ngân hàng, chứng khoán và bảo hiểm trả lỗi `unsupported`.

Kết quả thành công có `ok: true`, `value` và `warnings`. Thành công chỉ xác nhận có thể dựng các trường theo quy tắc hiện tại; một số hoặc toàn bộ giá trị vẫn có thể là `null`. Lỗi trả `ok: false`, `value: null`, `code` và `issues`:

| Code | Ví dụ |
| --- | --- |
| `missing_data` | Không tìm thấy anchor hoặc thiếu một kỳ bắt buộc |
| `incompatible` | Sai loại anchor, khác phạm vi/cơ sở, nhiều phiên bản khả dụng, CAPEX dẫn xuất âm |
| `invalid` | JSON/schema không hợp lệ, ngày sai, nguồn không tồn tại, số không hữu hạn hoặc vượt phạm vi an toàn |
| `unsupported` | Ngành chưa có mô hình TTM |

## Hai đường tính

### Bốn quý riêng lẻ

Anchor phải có `kind: "quarter"`. Với một chỉ tiêu dòng `X`:

```text
X_TTM = X_Q(t−3) + X_Q(t−2) + X_Q(t−1) + X_Q(t)
```

Mô-đun tìm đúng bốn quý tài chính liên tiếp, kể cả khi đi qua năm tài chính trước. Thứ tự `reportIds` là quý cũ nhất đến quý mới nhất; thứ tự trong mảng dữ liệu gốc không quyết định phép cộng. `startDate` lấy từ quý đầu tiên, `endDate` lấy từ anchor.

Ví dụ minh họa: kết thúc Q2/2025 thì cần Q3/2024, Q4/2024, Q1/2025 và Q2/2025. Báo cáo YTD sáu tháng không được dùng như số riêng của Q2. Hàm không tự chuyển YTD thành quý hoặc dùng FY để thay một quý thiếu.

### FY trước + YTD hiện tại − YTD cùng kỳ trước

Anchor phải có `kind: "ytd"`. Với quý tài chính `q` của năm `y`:

```text
X_TTM = X_FY(y−1) + X_YTD(y,q) − X_YTD(y−1,q)
```

Phải có đủ năm tài chính trước, YTD hiện tại và YTD cùng quý tài chính của năm trước. `reportIds` theo đúng thứ tự toán hạng **[FY trước, YTD hiện tại, YTD trước]**; hệ số tương ứng là **[+1, +1, −1]**. `startDate` là ngày tiếp theo sau cuối kỳ YTD trước; `endDate` là cuối kỳ YTD hiện tại.

Ví dụ giả lập: FY có doanh thu 100, YTD hiện tại 60 và YTD trước 40, cùng đơn vị/cơ sở, thì doanh thu TTM bằng 120. Đây chỉ là ví dụ phép tính, không phải số liệu của mã cổ phiếu nào.

## Dòng trong kỳ, số dư cuối kỳ và EPS

| Nhóm | Xử lý |
| --- | --- |
| Các trường `INCOME_FIELDS`, trừ `dilutedEps` | Cộng bốn quý hoặc FY + YTD − YTD trước |
| `cfo`, `capex`, `cfi`, `cff` | Cùng phép cộng/trừ chỉ tiêu dòng |
| Toàn bộ `BALANCE_FIELDS` | Giữ giá trị cuối kỳ của anchor; không cộng/trừ các số dư |
| `dilutedEps` | Luôn `null`, kèm cảnh báo |

Mỗi toán hạng được chuẩn hóa về `unit` trước khi tính. Tiền tệ vẫn là `dataset.currency`; đổi thang nghìn/triệu/tỷ không phải đổi ngoại tệ. Nếu một toán hạng cần thiết là `null`, chỉ tiêu dẫn xuất tương ứng giữ `null`, có cảnh báo và đầy đủ bằng chứng đầu vào. Số 0 hợp lệ được giữ nguyên. Các tổng trung gian cũng phải hữu hạn và không vượt `Number.MAX_SAFE_INTEGER`.

CAPEX và khấu hao dùng quy ước đầu vào không âm. Nếu phép trừ FY/YTD làm chúng âm, mô-đun dừng để người dùng đối chiếu dữ liệu/cơ sở điều chỉnh. Dòng tiền đầu tư hoặc tài trợ âm vẫn có thể hợp lệ.

EPS không được cộng hoặc trừ giữa các kỳ. Phiên bản này chưa có chuỗi cổ phiếu bình quân gia quyền và điều chỉnh pha loãng tương thích để dựng EPS TTM; cũng không lấy cổ phiếu đang lưu hành tại một ngày thay cho cơ sở đó.

Việc phân biệt số dư tại ngày cuối kỳ, kết quả trong kỳ và dòng tiền lũy kế phù hợp với cách trình bày các kỳ báo cáo trong [IAS 34, đoạn 20](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ias-34-interim-financial-reporting.pdf?bypass=on). Tham chiếu này giải thích tính chất các kỳ; công thức TTM ở trên là phép tổng hợp của ứng dụng, không phải tuyên bố tuân thủ IFRS hoặc xác nhận chuẩn kế toán của bộ dữ liệu Việt Nam.

## Kiểm tra lịch, phạm vi và phiên bản

Đầu vào qua `financialDatasetSchema` trước khi tuần tự hóa, tránh việc `NaN`/`Infinity` bị biến thành `null`, rồi qua `parseFinancialDataset`. Ngày bắt đầu/kết thúc phải khớp `expectedPeriodDates` theo `fiscalYearEndMonth` của dataset. Năm tài chính không kết thúc tháng 12 được hỗ trợ. Chuyển lịch tài chính giữa các kỳ, năm ngắn/dài và lịch 52/53 tuần chưa được hỗ trợ; không ép chúng thành cửa sổ thông thường.

Mỗi kỳ cần cùng `scope` với anchor và có chuỗi `basis` bằng anchor. Nếu chỉ có kỳ khác phạm vi, trả lỗi; nếu cùng kỳ/cùng phạm vi có nhiều phiên bản, trả lỗi thay vì tự chọn bản mới nhất. Metadata `restatement` cho phép lưu phiên bản báo cáo, nhưng nhãn revision của các năm không cần giống nhau. Nó không thay cho việc người dùng đối chiếu cơ sở có thể so sánh. Chọn bản gốc hay bản điều chỉnh phải được giải quyết trước khi tính.

ID nguồn, ID báo cáo, ngày công bố và quy ước giá trị tiếp tục chịu các ràng buộc của schema chung. Toàn dataset được kiểm tra; một báo cáo không hợp lệ ngoài cửa sổ TTM cũng có thể làm đầu vào bị từ chối.

## Truy vết đầy đủ

`inputs` chứa `key`, giá trị đã chuẩn hóa, `sourceId`, `locator` và `periodId` của từng đầu vào gốc. Với chỉ tiêu dòng, giữ mọi toán hạng theo thứ tự `reportIds`; với số dư, chỉ giữ kỳ anchor thực sự được dùng. Với EPS, giữ bằng chứng các kỳ để đối chiếu nhưng không tính kết quả. Không dùng riêng `report.fields` làm bằng chứng đầy đủ cho một phép tổng hợp nhiều báo cáo.

Mọi Fact của report dẫn xuất trỏ vào một nguồn tổng hợp `CALC_TTM_…`; `source.title` ghi rõ `CALCULATED TTM`, URL trống. Nguồn này mang `mock` nếu bất kỳ nguồn đầu vào liên quan là MOCK, nếu không là `user_supplied`. **`user_supplied` không có nghĩa là Verified Data.** Các nguồn gốc vẫn nằm trong dataset và có thể tra từ `inputs`.

`source.accessedAt` kế thừa ngày truy cập mới nhất của các nguồn đầu vào, không phải ngày hệ thống vừa tải dữ liệu mới. `report.publishedAt` là ngày công bố muộn nhất của các báo cáo thành phần, không phải ngày doanh nghiệp công bố TTM. Report dẫn xuất mang `audited: "unaudited"`; không kế thừa nhãn kiểm toán của các báo cáo thành phần.

## Tích hợp nội bộ và giới hạn tiếp theo

Hiện `report.kind` tạm dùng `annual` để tương thích các bảng hiện có, `fiscalQuarter: null`, ID bắt đầu `TTM_…`. Đây không phải nhãn FY thật. Giao diện phân tích thêm metadata nội bộ:

```ts
const calculatedReport = {
  ...result.value.report,
  derived: {
    method: result.value.method,
    inputs: result.value.inputs,
    reportIds: result.value.reportIds,
  },
};
```

Giao diện ghép nguồn tổng hợp vào bản dataset tạm dành cho hiển thị/tỷ số và hiển thị TTM là Calculated. Dataset JSON gốc để lưu/nhập vẫn chứa báo cáo công bố. Schema nhập từ người dùng không nhận thuộc tính `derived`: không xuất một report TTM rời rồi xóa metadata để nhập nó như FY. Riêng `kind: "annual"` không đủ phân biệt TTM, nhất là khi cửa sổ trùng năm tài chính; người tích hợp phải giữ toàn bộ metadata này.

Định giá, gồm FCFF–DCF, hiện yêu cầu báo cáo năm gốc hợp lệ và khóa report có `derived`; chưa dự phóng từ TTM. Tỷ số sử dụng TTM vẫn chịu các guard riêng về số dư đầu kỳ, thị trường, cổ phiếu và tính phù hợp mẫu số. Việc dựng được TTM không đảm bảo mọi tỷ số hoặc định giá khả dụng.

Các phần chưa triển khai: EPS TTM có cơ sở pha loãng đã đối chiếu; mô hình TTM ngành tài chính; tự giải quyết điều chỉnh hồi tố; chuyển lịch/năm 52–53 tuần; tự đọc và xác minh tài liệu nguồn; tự chuẩn hóa báo cáo YTD thành bốn quý; dự phóng DCF từ TTM; loại kỳ `ttm` riêng trong schema lưu trữ. Những thay đổi này cần contract và kiểm thử mới trước khi mở chức năng.

Kiểm thử thuật toán nằm tại `src/lib/financial/ttm.test.ts`, chạy bằng `npm test -- src/lib/financial/ttm.test.ts`. Các ca gồm hai phương pháp, đổi thang đơn vị, năm tài chính tháng 3/6/9, giữ số dư, EPS trống, nguồn MOCK, null/0, kỳ thiếu, khác scope/basis, nhiều phiên bản, ngày/nguồn sai và giới hạn số an toàn.
