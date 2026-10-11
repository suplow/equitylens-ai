import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { CorporateDataset } from "../src/lib/financial/types";

async function stable() {
  const data = JSON.parse(await readFile("src/lib/financial/fixtures/stable.input.json", "utf8")) as CorporateDataset;
  data.symbol = "FPT";
  return data;
}
async function load(page: Page, data: CorporateDataset) {
  await page.goto("/financials/FPT");
  await page.getByLabel("Chọn tệp dữ liệu tài chính JSON").setInputFiles({ name: "independent.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
}

test("independent quarters reach TTM ratios and original source lineage", async ({ page }) => {
  await load(page, await stable());
  await page.getByLabel("Annual / Quarterly / TTM", { exact: true }).selectOption("ttm");
  await expect(page.getByRole("heading", { name: "TTM · Calculated Metrics", exact: true })).toBeVisible();
  // Independent fixture: gross profit 430m / revenue 1,075m = 40%.
  const margin = page.locator(".fe-ratio").filter({ has: page.getByRole("heading", { name: "Biên lợi nhuận gộp", exact: true }) });
  await expect(margin.locator(".fe-ratio-value")).toHaveText("40,00%");
  const pe = page.locator(".fe-ratio").filter({ has: page.getByRole("heading", { name: "P/E pha loãng", exact: true }) });
  await expect(pe.locator(".fe-ratio-value")).toHaveText("—");
  await page.getByText("Tất cả kỳ và nguồn tham gia phép tính", { exact: true }).click();
  const ttmPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "TTM · Calculated Metrics", exact: true }) });
  await expect(ttmPanel.getByText(/revenue:.*FY2024_Q4.*SYNTHETIC/)).toBeVisible();
  await page.getByLabel("Annual / Quarterly / TTM", { exact: true }).selectOption("quarter");
  await expect(page.getByRole("heading", { name: "TTM · Calculated Metrics", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Data Quality · Chất lượng & truy vết", exact: true })).toBeVisible();
});

test("YTD preview stays accessible and never picks an arbitrary restatement", async ({ page }) => {
  const data = await stable();
  const original = data.reports.find(r => r.id === "FY2025_YTD1")!;
  const revised = structuredClone(original);
  revised.id = "YTD1_RESTATED";
  revised.restatement = { status: "restated", revision: "v2", note: "Independent regression case" };
  data.reports.push(revised);
  await load(page, data);
  await page.getByLabel("Annual / Quarterly / TTM", { exact: true }).selectOption("ytd");
  await page.getByText("Xem dòng quý từ YTD", { exact: true }).click();
  await expect(page.locator(".fe-ytd-preview")).toContainText("nhiều phiên bản");
  await expect(page.locator(".fe-ytd-preview table")).toHaveCount(0);
});

test("a later share count preserves enterprise value but locks per-share valuation", async ({ page }) => {
  const data = await stable(); data.market!.sharesAsOf = data.market!.asOf;
  await page.goto("/valuation/FPT");
  await page.getByLabel("Chọn tệp dữ liệu tài chính JSON").setInputFiles({ name: "dated.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
  await page.getByRole("button", { name: "Nạp giả định MOCK", exact: true }).click();
  const panel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Kết quả DCF–FCFF", exact: true }) });
  const row = panel.getByRole("row").filter({ has: page.getByRole("cell", { name: "Base", exact: true }) });
  await expect(row.getByRole("cell").nth(1)).not.toHaveText("—");
  await expect(row.getByRole("cell").nth(3)).toHaveText("— VND");
  await expect(row.getByRole("cell").nth(4)).toHaveText("—");
  await expect(row).toContainText("cổ phiếu");
});
