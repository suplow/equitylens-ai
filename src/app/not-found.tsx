import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="phase-placeholder">
      <strong>Không tìm thấy trang hoặc mã cổ phiếu</strong>
      <p>Bộ dữ liệu demo gồm FPT, VNM, HPG, VCB, MBB và REE.</p>
      <br />
      <Button asChild>
        <Link href="/">Về tổng quan</Link>
      </Button>
    </div>
  );
}
