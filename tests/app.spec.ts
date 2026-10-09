import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("dashboard renders mock provenance without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      errors.push(message.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Góc nhìn thị trường" }),
  ).toBeVisible();
  await expect(
    page.getByText("DỮ LIỆU MINH HỌA", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".recharts-area-curve")).toBeVisible();
  await mkdir("qa", { recursive: true });
  await page.screenshot({ path: "qa/dashboard-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("search resolves a stock and chart ranges change", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("textbox", { name: "Tìm mã cổ phiếu" });
  await search.fill("ZZZ");
  await expect(page.getByText(/Không tìm thấy mã/)).toBeVisible();
  await search.fill("vnm");
  await search.press("Enter");
  await expect(page).toHaveURL(/stocks\/VNM$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("VNM");
  await page.getByRole("button", { name: "1T", exact: true }).click();
  await expect(page.getByRole("img", { name: /30 ngày/ })).toBeVisible();
  await page.screenshot({ path: "qa/stock-desktop.png", fullPage: true });
});
test("watchlist changes survive reload and handles an empty list", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Bỏ theo dõi FPT", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Bỏ theo dõi FPT", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Thêm mã", exact: true }).click();
  await page.getByRole("button", { name: "Theo dõi FPT", exact: true }).click();
  await page
    .getByRole("button", { name: "Đang theo dõi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bỏ theo dõi FPT", exact: true }),
  ).toBeVisible();
  for (const symbol of ["FPT", "VNM", "HPG", "MBB"])
    await page
      .getByRole("button", { name: `Bỏ theo dõi ${symbol}`, exact: true })
      .click();
  await expect(page.getByText(/Chưa có mã theo dõi/)).toBeVisible();
});
test("all destinations retain symbol and incomplete features are honest", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      errors.push(message.text());
  });
  await page.goto("/stocks/HPG");
  await page
    .getByRole("link", { name: "Báo cáo tài chính", exact: true })
    .click();
  await expect(page).toHaveURL(/financials\/HPG$/);
  await page
    .getByRole("button", { name: "Bảng cân đối kế toán", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Tổng tài sản", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lưu chuyển tiền tệ", exact: true })
    .click();
  await expect(
    page.getByRole("cell", {
      name: "Dòng tiền từ hoạt động kinh doanh",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: "qa/financials-desktop.png", fullPage: true });
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Định giá", exact: true })
    .click();
  await expect(
    page.getByText("Không có kết quả định giá trong Phase 1."),
  ).toBeVisible();
  await page.getByRole("link", { name: /AI Research Analyst/ }).click();
  await page
    .getByRole("button", {
      name: "Giải thích ROE và giới hạn khi sử dụng chỉ số này.",
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Câu hỏi cho AI Analyst" }),
  ).toHaveValue("Giải thích ROE và giới hạn khi sử dụng chỉ số này.");
  await expect(
    page.getByRole("button", { name: "Tạo hồ sơ nghiên cứu", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("KHÔNG CẦN API KEY", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Báo cáo nghiên cứu", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Xuất PDF/ })).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: /Executive Summary/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("all stock views fit a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const section of [
    "stocks",
    "financials",
    "valuation",
    "analyst",
    "reports",
  ]) {
    await page.goto(`/${section}/VCB`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("VCB");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
test("unknown stock shows recoverable not-found state", async ({ page }) => {
  await page.goto("/stocks/ZZZ");
  await expect(
    page.getByText("Không tìm thấy trang hoặc mã cổ phiếu"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Về tổng quan" }).click();
  await expect(page).toHaveURL(/\/$/);
});
test("responsive layouts and mobile menu", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 390) {
      await page.screenshot({
        path: "qa/dashboard-mobile.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Mở menu", exact: true }).click();
      await page
        .getByRole("link", { name: "Phân tích cổ phiếu", exact: true })
        .click();
      await expect(page).toHaveURL(/stocks\/FPT$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "FPT",
      );
      await page.screenshot({ path: "qa/stock-mobile.png", fullPage: true });
    }
  }
});
