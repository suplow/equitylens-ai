import { z } from "zod";
import { failure, success } from "./result";
import type { Calculation, Industry } from "./types";
const multiple = z.number().finite().positive().max(1e6).nullable();
const peerSchema = z.object({
  symbol: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/), industry: z.enum(["corporate", "bank", "securities", "insurance"]), period: z.string().min(1).max(60),
  source: z.object({ title: z.string().trim().min(2).max(200), url: z.string().max(2000).refine(s => { if (!s) return true; try { const u = new URL(s); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }), asOf: z.string().refine(s => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s), provenance: z.enum(["user_supplied", "mock"]) }).strict(),
  pe: multiple, pb: multiple, evEbitda: multiple, selectionReason: z.string().trim().min(5).max(1000),
  differences: z.object({ size: z.string().trim().min(1).max(500), growth: z.string().trim().min(1).max(500), profitability: z.string().trim().min(1).max(500), capitalStructure: z.string().trim().min(1).max(500) }).strict(),
}).strict();
export type PeerInput = z.infer<typeof peerSchema>;
export function parsePeers(raw: string): Calculation<PeerInput[]> {
  if (raw.length > 100000) return failure("invalid", "Peer JSON tối đa 100.000 ký tự.");
  let json: unknown; try { json = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { return failure("invalid", "Danh sách peer phải là JSON array."); }
  const parsed = z.array(peerSchema).max(30).safeParse(json);
  if (!parsed.success) return failure("invalid", ...parsed.error.issues.slice(0,6).map(i => `${i.path.join(".")}: ${i.message}`));
  if (new Set(parsed.data.map(p => p.symbol)).size !== parsed.data.length) return failure("invalid", "Mã peer bị lặp.");
  return success(parsed.data);
}
export function peerMedian(peers: PeerInput[], method: "pe" | "pb" | "evEbitda", targetIndustry: Industry, targetPeriod: string): Calculation<number> {
  if (targetIndustry !== "corporate") return failure("unsupported", "Định chế tài chính cần bộ so sánh và schema chuyên ngành trước khi định giá.");
  if (!peers.length) return failure("missing_data", "Chưa nhập doanh nghiệp so sánh có nguồn.");
  if (peers.some(p => p.industry !== targetIndustry || p.period !== targetPeriod)) return failure("incompatible", "Tất cả peer phải cùng nhóm doanh nghiệp và kỳ/basis số liệu trước khi tính trung vị.");
  const values = peers.map(p => p[method]).filter((v): v is number => v !== null && Number.isFinite(v) && v > 0).sort((a,b) => a - b);
  if (!values.length) return failure("missing_data", "Không có hệ số dương hợp lệ cho phương pháp này. Không tự tạo số peer.");
  const mid = Math.floor(values.length / 2), median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return success(median, [`Trung vị ${values.length}/${peers.length} peer có hệ số; ${peers.length - values.length} mục thiếu không tham gia.`, "Lựa chọn peer, định nghĩa EPS/vốn/EBITDA, thời điểm giá và khác biệt quy mô/tăng trưởng/lợi nhuận/cơ cấu vốn cần đối chiếu thủ công; cùng mã kỳ chưa đủ chứng minh tương đồng.", ...(peers.some(p => p.source.provenance === "mock") ? ["MOCK · Trung vị chứa dữ liệu luyện tập."] : [])]);
}
