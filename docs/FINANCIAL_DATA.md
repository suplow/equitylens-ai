# Financial dataset v2 — nhập, kiểm tra và lưu local

## Cách dùng

1. Mở `/financials/FPT` (hoặc một mã hiện có), chọn **Financial Engine**.
2. **Tải mẫu JSON trống**, điền số liệu và nguồn, rồi **Nhập tệp JSON**. Có thể dán JSON và bấm **Kiểm tra & áp dụng JSON**. Muốn luyện tập, dùng **Nạp dữ liệu MOCK**; đây là fixture độc lập, không phải dữ liệu FPT.
3. Chọn kỳ phân tích. Mở từng ô báo cáo để xem đơn vị gốc, ID nguồn, trang/bảng và ngày công bố. Mở thẻ tỷ số để xem công thức và toàn bộ đầu vào.
4. **Lưu dữ liệu local** lưu trong localStorage của trình duyệt, theo mã. Chuyển sang `/valuation/FPT` rồi **Tải bản đã lưu**. Không tự tải hoặc ghi đè dữ liệu khi mở trang.
5. **Xuất JSON dữ liệu** tạo bản sao trên máy. Lưu hoặc xuất trước khi đổi tab Engine/demo, chuyển trang hay reload; dữ liệu chưa lưu chỉ ở bộ nhớ.
6. Nhập giả định Bear/Base/Bull (tỷ lệ theo %, hệ số theo lần). Dữ liệu thực không có giả định mặc định; preset chỉ xuất hiện với MOCK. Giả định lưu riêng theo mã/kỳ, có thể tải lại hoặc xuất JSON. Peer JSON được nhập riêng, chưa được lưu vào bundle nghiên cứu.

localStorage gắn với origin: `localhost:3000`, `127.0.0.1:3000`, cổng khác và trình duyệt khác là các kho riêng. Xóa dữ liệu trình duyệt có thể mất bản lưu. JSON xuất ra là cách sao lưu chủ động. Không có đồng bộ tài khoản hay cơ sở dữ liệu.

## Hợp đồng dữ liệu

Nguồn chuẩn: `src/lib/financial/types.ts` và schema Zod strict trong `schema.ts`. Phiên bản `2.0`, tối đa 40 kỳ, 50 nguồn; JSON tối đa 1.000.000 ký tự và UI giới hạn 1 MiB UTF-8. Tất cả khóa bắt buộc phải có; dữ liệu chưa biết là `null`. Không dùng chuỗi số, NaN, dấu phân cách hàng nghìn hoặc bỏ khóa.

| Cấp | Trường và ý nghĩa |
| --- | --- |
| Dataset | `version`, `symbol`, `name`, `industry`, `currency`, `fiscalYearEndMonth`, `sources`, `reports`, `market` |
| Source | `id`, `title`, `url` (có thể trống), `accessedAt`, `provenance: user_supplied hoặc mock` |
| Kỳ | `id`, `kind: annual/quarter/ytd`, `fiscalYear`, `fiscalQuarter`, `startDate`, `endDate`, `scope`, `audited`, `publishedAt`, `basis` |
| Fact | `value: number hoặc null`, `unit`, `sourceId`, `locator` (trang/bảng/dòng tài liệu) |
| Market | `asOf`, `price: Fact`, `sharesOutstanding: Fact`, `basis`; cả object có thể là null |

Ví dụ một fact trong `reports[0].fields.revenue`:

```json
{"value": 1200, "unit": "million", "sourceId": "BCTC2025", "locator": "Trang 12, doanh thu thuần"}
```

Mỗi fact **kế thừa** tiền tệ của dataset và toàn bộ metadata của kỳ chứa nó. `sourceId` phải có trong registry. `audited` là trạng thái người nhập khai báo, không phải xác nhận của ứng dụng. Không cho import nhãn `verified`. URL chỉ HTTP(S), không chứa credentials; nguồn không được ứng dụng tự tải.

### Đơn vị và quy ước kế toán

- Engine tính bằng đơn vị tiền gốc: VND, USD hoặc EUR; `unit/thousand/million/billion` nhân lần lượt 1/1.000/1.000.000/1.000.000.000. UI bảng hiển thị tỷ VND hoặc triệu USD/EUR; mở ô để xem đầu vào. Số tính không bị làm tròn theo số hiển thị.
- Giá và EPS bắt buộc `unit` = tiền/cổ phiếu. Cổ phiếu lưu hành được chuẩn hóa về **số cổ phiếu**, không phải đơn vị tiền; có thể nhập 0,1 million = 100.000 cổ phiếu.
- Chỉ một currency trong dataset. `convertUnit` từ chối khác currency: không tự suy tỷ giá. Dữ liệu sau chuẩn hóa và kết quả phải hữu hạn, trị tuyệt đối ≤ `Number.MAX_SAFE_INTEGER`; phép tính dùng IEEE-754, không phải ledger kế toán decimal chính xác đến cent.
- CAPEX là **chi dương** (mua/xây dựng tài sản hoạt động), không lấy tổng CFI âm làm CAPEX. CFO/CFI/CFF có thể âm. D&A không âm. Khoản cầu nối không có phải khai báo 0 có nguồn, không để null nếu muốn định giá.
- `shareholdersEquity` là vốn thuộc cổ đông **thường công ty mẹ**, tách `minorityInterest` và `preferredEquity`; không nhập tổng vốn hợp nhất vào cả ba. `netIncomeToCommon` tương ứng lợi nhuận cổ đông thường, sau quyền lợi ưu đãi; `netIncome` là tổng lợi nhuận báo cáo.
- Nợ vay ngắn/dài hạn là nợ chịu lãi, không phải toàn bộ nợ phải trả. Người nhập quyết định xử lý thuê tài sản nhất quán với EBIT/EBITDA/FCFF.
- `operatingWorkingCapital` là vốn lưu động hoạt động không gồm tiền/nợ vay, nhập từ tài liệu đối chiếu. `nonOperatingAssets` không gồm tiền; `otherClaims` không trùng nợ vay/NCI/vốn ưu đãi.
- EPS pha loãng là số được cung cấp, không suy từ cổ phiếu lưu hành hiện tại. `basis` mô tả kế toán, điều chỉnh lại và chia tách/corporate actions. App so khớp chuỗi basis, không tự kiểm chứng nội dung hoặc điều chỉnh giá.

Kiểm tra nhất quán nội bộ: lợi nhuận gộp = doanh thu − giá vốn; LN sau thuế = LNTT − thuế; tài sản = nợ + vốn thường + NCI + vốn ưu đãi; ngắn hạn không lớn hơn tổng. Sai lệch vượt dung sai làm tròn theo đơn vị nguồn khóa engine cho kỳ liên quan. Các đẳng thức này không thay kiểm toán và chưa đối chiếu đầy đủ ba báo cáo.

### Kỳ báo cáo

`fiscalYear` là năm kết thúc năm tài chính; `annual` có `fiscalQuarter: null`, quarter/YTD có quý 1–4. Ngày phải khớp tháng kết thúc năm tài chính, công bố không trước cuối kỳ. Chưa hỗ trợ lịch 52/53 tuần hoặc kỳ chuyển đổi khác độ dài chuẩn.

- Tỷ số hoạt động theo độ dài kỳ đã nhập, không tự nhân bốn. Tăng trưởng so cùng loại, quý, scope và basis năm trước.
- Bình quân dùng kỳ có ngày kết thúc ngay trước ngày bắt đầu kỳ hiện tại, cùng scope/basis. Không thay thiếu đầu kỳ bằng số cuối kỳ.
- Biểu đồ chỉ ghép các năm cùng scope/basis của kỳ được chọn; loại kỳ có nhiều phiên bản chưa giải quyết. Không tự chọn theo thứ tự JSON.
- `convertYtdToQuarter` lấy dòng YTD hiện tại trừ YTD quý liền trước, sau chuẩn hóa; số dư giữ cuối kỳ. Q1 bằng YTD Q1. Null lan truyền; EPS không được trừ vì mẫu số bình quân gia quyền có thể khác. Kết quả dẫn xuất giữ lineage của cả hai kỳ. UI chỉ xem chuyển đổi, không ghi đè báo cáo đầu vào.
- Chỉ số thị trường dùng năm đầy đủ hoặc TTM đủ điều kiện; EPS TTM chưa hỗ trợ nên P/E TTM bị khóa. Định giá chỉ nhận năm báo cáo đầy đủ, không nhận TTM dẫn xuất. Xem [TTM](TTM.md).

### Metadata và ngày trong Phase 2.1

- `analysisAsOf`: ngày nghiên cứu rõ ràng; không mặc định ngày máy. Thiếu ngày này khóa tỷ số thị trường/so sánh giá, không xóa kết quả nội tại hồi cứu đủ dữ liệu.
- `market.sharesAsOf`: ngày số cổ phiếu. DCF/relative cần đúng ngày cuối năm cơ sở mới chia giá trị vốn chủ. Thiếu/sai ngày vẫn giữ EV/equity nếu đủ đầu vào, per-share là null; P/E bị khóa khi không có cổ phiếu phù hợp.
- `corporateActions`: `{reviewedFrom, reviewedThrough, sourceId, events:[{date,kind}]}`. Coverage chỉ là khai báo chưa xác minh; có split/issuance/buyback/other thì khóa tỷ số thị trường qua khoảng thay đổi đến khi có mô hình điều chỉnh. Không tự tính hệ số chia tách.
- `report.restatement`: `{status: original|restated, revision, note}`. Các revision khác nhau có thể cùng ngày; không tự ưu tiên bản mới nhất. Khác `basis` không được trộn.
- `report.openingReportId`: chọn rõ số dư trước ngày đầu kỳ khi có nhiều báo cáo cùng ngày. ID phải đúng ngày/scope/basis/lịch tài chính, không phải cơ chế bỏ qua validation. Thiếu lựa chọn khi mơ hồ khóa các tỷ số bình quân và FCFF lịch sử.
- Legacy JSON v2 không có các trường tùy chọn vẫn đọc được, nhưng kết quả cần chúng sẽ bị khóa. Không ghi đè dữ liệu hoặc tự bổ sung ngày.
- [Data Quality](DATA_QUALITY.md) giữ nguồn ở MOCK hoặc USER_SUPPLIED_UNVERIFIED; validation không xác minh nguồn. Các chênh lệch dòng tiền được cảnh báo, không tự sửa số dư.

### Định chế tài chính và phạm vi mã

`industry` là discriminated union: corporate, bank, securities, insurance. Mỗi ngành có shape riêng; đổi nhãn corporate thành bank sẽ không qua schema. Ba schema định chế tài chính mới là khung: tỷ số corporate và mọi định giá đều khóa, kể cả P/B, cho đến khi có mô hình chuyên ngành đầy đủ.

UI hiện giữ danh mục sáu mã Phase 1; VCB/MBB chỉ nhận bank, bốn mã còn lại nhận corporate. Engine/schema hỗ trợ mã tổng quát nhưng chưa có màn hình thêm mã, công ty chứng khoán hoặc bảo hiểm. Không đồng nghĩa đã bao phủ toàn thị trường.

## Peer JSON

Mảng tối đa 30 mục. Có thể để `[]`; không có fixture peer tự động. Ví dụ **cấu trúc trống**, không chứa số thị trường:

```json
[{
  "symbol": "ABC", "industry": "corporate", "period": "FY2025",
  "source": {"title": "Điền nguồn so sánh", "url": "", "asOf": "2026-04-01", "provenance": "user_supplied"},
  "pe": null, "pb": null, "evEbitda": null,
  "selectionReason": "Điền lý do chọn doanh nghiệp",
  "differences": {"size": "Cần đối chiếu", "growth": "Cần đối chiếu", "profitability": "Cần đối chiếu", "capitalStructure": "Cần đối chiếu"}
}]
```

Chỉ trung vị các hệ số dương không thiếu, hiển thị số mẫu sử dụng; khác ngành/kỳ thì khóa. `corporate` chỉ là phân loại rộng, không chứng minh cùng ngành kinh doanh. Scope, ngày giá, basis, cách định nghĩa EPS/EBITDA, quy mô/tăng trưởng và chất lượng lợi nhuận cần người dùng đối chiếu. App không tự điều chỉnh premium/discount hay xác minh peer. Trung vị đưa vào scenario như **Analyst Assumption**; peer MOCK không áp vào dataset không có MOCK.

## Ranh giới AI và bảo mật

Không gọi AI để xử lý số, không chạy biểu thức trong JSON. React hiển thị chuỗi nguồn/locator dưới dạng text. Import/lưu/khôi phục đều qua schema; JSON đang sửa hoặc lỗi khiến kết quả cũ ẩn đi. Không đọc file ngoài file người dùng chọn, không tự tải URL nguồn, không gửi báo cáo ra server. Luồng ChatGPT Phase 1 vẫn riêng, chưa đính kèm output Engine vào packet.
