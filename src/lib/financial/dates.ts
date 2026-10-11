import { isDate } from "./schema";
import { failure, success } from "./result";
import type { Calculation, CorporateDataset, CorporateReport } from "./types";

export interface ComparisonDates { valuationAsOf: string; marketAsOf: string; sharesAsOf: string; analysisAsOf: string }
export function comparisonDateGuard(dates?: ComparisonDates): Calculation<true> {
  if (!dates || !Object.values(dates).every(isDate)) return failure("incompatible", "Khóa upside/Margin of Safety: thiếu hoặc sai ngày định giá, giá, cổ phiếu hoặc ngày phân tích.");
  if (dates.valuationAsOf !== dates.marketAsOf || dates.sharesAsOf !== dates.valuationAsOf || dates.marketAsOf > dates.analysisAsOf) return failure("incompatible", "Khóa upside/Margin of Safety: khác ngày định giá/giá/cổ phiếu hoặc ngày giá vượt ngày phân tích; chưa có roll-forward hợp lệ.");
  if ((Date.parse(dates.analysisAsOf) - Date.parse(dates.marketAsOf)) / 86400000 > 30) return failure("incompatible", "Giá tham chiếu cũ hơn 30 ngày so với ngày phân tích; khóa so sánh theo chính sách freshness của ứng dụng.");
  return success(true);
}
export function valuationDates(data: CorporateDataset, report: CorporateReport): ComparisonDates | undefined {
  if (!data.market || !data.analysisAsOf || !data.market.sharesAsOf) return undefined;
  return { valuationAsOf: report.endDate, marketAsOf: data.market.asOf, sharesAsOf: data.market.sharesAsOf, analysisAsOf: data.analysisAsOf };
}
export function actionsGuard(data: CorporateDataset, from: string, through: string): Calculation<true> {
  if (from === through) return success(true);
  const a = data.corporateActions;
  if (!a || a.reviewedFrom > from || a.reviewedThrough < through || !data.sources.some(s => s.id === a.sourceId)) return failure("incompatible", "Chưa đủ nguồn rà soát corporate actions giữa ngày số liệu/cổ phiếu và ngày giá.");
  if (a.events.some(e => e.date > from && e.date <= through)) return failure("incompatible", "Có corporate action trong khoảng so sánh; chưa có phương pháp điều chỉnh cổ phiếu/EPS/cầu nối vốn chủ.");
  return success(true, ["Corporate actions do người dùng cung cấp; chưa xác minh tài liệu gốc."]);
}
export function marketDateGuard(data: CorporateDataset, report: CorporateReport): Calculation<true> {
  const market = data.market;
  if (!market || !isDate(market.asOf) || !data.analysisAsOf || !isDate(data.analysisAsOf)) return failure("missing_data", "Thiếu ngày phân tích analysisAsOf hoặc ngày giá hợp lệ.");
  if (market.asOf > data.analysisAsOf || report.publishedAt > market.asOf) return failure("incompatible", "Ngày giá không được sau ngày phân tích hoặc trước ngày công bố báo cáo.");
  if ((Date.parse(data.analysisAsOf) - Date.parse(market.asOf)) / 86400000 > 30) return failure("incompatible", "Giá tham chiếu cũ hơn 30 ngày; cần cập nhật nguồn trước khi tính chỉ số thị trường.");
  const sharesAt = market.sharesAsOf ?? market.asOf;
  if (!isDate(sharesAt) || sharesAt > market.asOf) return failure("incompatible", "Ngày số cổ phiếu không hợp lệ hoặc sau ngày giá.");
  return actionsGuard(data, report.endDate < sharesAt ? report.endDate : sharesAt, market.asOf);
}
