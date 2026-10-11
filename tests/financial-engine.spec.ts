import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { createDatasetTemplate } from "../src/lib/financial/schema";
import type { CorporateDataset } from "../src/lib/financial/types";

const sample = () => createDatasetTemplate("FPT", "corporate", true) as CorporateDataset;
async function importData(page: Page, data: unknown) {
  await page.getByLabel("Chọn tệp dữ liệu tài chính JSON").setInputFiles({ name: "research.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
}
const ratio = (page: Page, name: string) => page.locator(".fe-ratio").filter({ has: page.getByRole("heading", { name, exact: true }) });
const scenarioRow = (page: Page, name: string) => page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Kết quả DCF–FCFF", exact: true }) }).getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) });

test("JSON data reaches ratios with units, provenance, local restore and export intact", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/financials/FPT");
  await importData(page, sample());
  await expect(ratio(page, "ROE").locator(".fe-ratio-value")).toHaveText("20,11%");
  await expect(ratio(page, "P/E pha loãng").locator(".fe-ratio-value")).toHaveText("6,82x");
  await ratio(page, "ROE").getByText("Công thức, đầu vào & giới hạn").click();
  await expect(ratio(page, "ROE")).toContainText("FY2024 · MOCK");
  await page.getByRole("button", { name: "Lưu dữ liệu local", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất JSON dữ liệu", exact: true }).click();
  const download = await downloadPromise;
  expect(JSON.parse(await readFile((await download.path())!, "utf8"))).toEqual(sample());
  await page.reload();
  await expect(page.getByText("Chưa có bộ dữ liệu hợp lệ cho FPT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tải bản đã lưu", exact: true }).click();
  await expect(ratio(page, "ROE").locator(".fe-ratio-value")).toHaveText("20,11%");
  await page.getByRole("button", { name: "Lưu chuyển tiền tệ", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "FCF đơn giản = CFO − CAPEX" })).toContainText("0,14");
  await mkdir("test-results/captures", { recursive: true });
  await page.screenshot({ path: "test-results/captures/phase2-financials-desktop.png", fullPage: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await ratio(page, "ROE").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/captures/phase2-ratios-mobile.png" });
  expect(errors).toEqual([]);
});

test("a hand-calculated flat FCFF case reaches DCF, sensitivity and changes immediately", async ({ page }) => {
  await page.goto("/valuation/FPT");
  await importData(page, sample());
  await page.getByRole("button", { name: "Nạp giả định MOCK", exact: true }).click();
  await page.getByLabel("Base · Tăng trưởng doanh thu", { exact: true }).fill("0");
  await page.getByLabel("Base · WACC", { exact: true }).fill("10");
  await page.getByLabel("Base · Tăng trưởng dài hạn", { exact: true }).fill("0");
  // 1,200m × (20% × 80% + 5% − 7%) = 168m perpetual FCFF;
  // EV 1,680m, equity 1,530m after cash 150m/debt 300m, 100,000 shares.
  await expect(scenarioRow(page, "Base").getByRole("cell").nth(1)).toHaveText("1,68");
  await expect(scenarioRow(page, "Base").getByRole("cell").nth(3)).toHaveText("15.300,00 VND");
  // Fiscal-year-end value cannot be compared with the later April market price.
  await expect(scenarioRow(page, "Base").getByRole("cell").nth(4)).toHaveText("—");
  await expect(scenarioRow(page, "Base").getByRole("cell").nth(5)).toHaveText("—");
  await expect(scenarioRow(page, "Base")).toContainText("ngày");
  const sensitivity = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Độ nhạy · Base", exact: true }) });
  await expect(sensitivity.getByRole("cell", { name: "15.300,00", exact: true })).toBeVisible();
  await page.getByLabel("Base · WACC", { exact: true }).fill("12");
  await expect(scenarioRow(page, "Base").getByRole("cell").nth(3)).toHaveText("12.500,00 VND");
  await page.getByText("Lưu / nhập lại giả định theo mã và kỳ", { exact: true }).click();
  await page.getByRole("button", { name: "Lưu giả định local", exact: true }).click();
  await page.getByLabel("Base · WACC", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Tải giả định đã lưu", exact: true }).click();
  await expect(page.getByLabel("Base · WACC", { exact: true })).toHaveValue("12");
  await page.getByLabel("Base · Tăng trưởng dài hạn", { exact: true }).fill("12");
  await expect(scenarioRow(page, "Base").getByRole("cell").nth(3)).toHaveText("—");
  await expect(scenarioRow(page, "Base")).toContainText("g<WACC");
  await page.getByLabel("Base · Tăng trưởng dài hạn", { exact: true }).fill("0");
  await mkdir("test-results/captures", { recursive: true });
  await page.screenshot({ path: "test-results/captures/phase2-valuation-desktop.png", fullPage: true });
  await scenarioRow(page, "Base").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/captures/phase2-dcf-results.png" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: "test-results/captures/phase2-valuation-mobile.png", fullPage: true });
  }
});

test("dirty/invalid JSON hides stale calculations; missing data and loss EPS remain explicit", async ({ page }) => {
  await page.goto("/financials/FPT");
  const data = sample(); data.sources[0].provenance = "user_supplied";
  data.sources[0].title = "<img src=x onerror=alert(1)> BCTC tự nhập thử nghiệm";
  data.reports[1].fields.dilutedEps.value = -1;
  data.reports[1].fields.cfo.value = null;
  await importData(page, data);
  await expect(ratio(page, "P/E pha loãng").locator(".fe-ratio-value")).toHaveText("—");
  await expect(ratio(page, "FCF đơn giản")).toContainText("Thiếu đầu vào");
  await expect(page.getByText(data.sources[0].title, { exact: true })).toBeVisible();
  await expect(page.locator(".fe-source-list img")).toHaveCount(0);
  await expect(page.getByText("NGUỒN TỰ NHẬP · CHƯA XÁC MINH", { exact: true })).toBeVisible();
  const editor = page.locator(".fe-json-editor").first();
  if ((await editor.getAttribute("open")) === null) await editor.locator("summary").click();
  await page.getByLabel("JSON dữ liệu tài chính", { exact: true }).fill('{"bad": true}');
  await expect(page.locator(".fe-ratio")).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm tra & áp dụng JSON", exact: true }).click();
  await expect(page.locator(".fe-errors[role=alert]")).toContainText("Chưa thể dùng dữ liệu");
  await expect(page.getByLabel("JSON dữ liệu tài chính", { exact: true })).toHaveValue('{"bad": true}');
});

test("institutional schema cannot unlock corporate valuation", async ({ page }) => {
  await page.goto("/valuation/VCB");
  await importData(page, createDatasetTemplate("VCB", "bank"));
  await expect(page.getByRole("heading", { name: "Ngân hàng cần mô hình chuyên ngành", exact: true })).toBeVisible();
  await expect(page.getByLabel("Base · WACC", { exact: true })).toHaveCount(0);
  const corporate = sample(); corporate.symbol = "VCB";
  await importData(page, corporate);
  await expect(page.locator(".fe-errors[role=alert]")).toContainText("yêu cầu bank");
});

test("peer medians need explicit comparable sources and a missing bridge blocks DCF", async ({ page }) => {
  await page.goto("/valuation/FPT");
  const data = sample(); data.reports[1].fields.otherClaims.value = null;
  await importData(page, data);
  await page.getByRole("button", { name: "Nạp giả định MOCK", exact: true }).click();
  await expect(scenarioRow(page, "Base").getByRole("cell").nth(3)).toHaveText("—");
  await expect(scenarioRow(page, "Base")).toContainText("Thiếu đầu vào");
  await page.getByText("Nhập JSON doanh nghiệp so sánh", { exact: true }).click();
  const peers = [10, 20].map((pe, i) => ({ symbol: `TEST${i}`, industry: "corporate", period: "FY2025", source: { title: "MOCK test peer", url: "", asOf: "2026-04-01", provenance: "mock" }, pe, pb: null, evEbitda: null, selectionReason: "Chỉ để kiểm thử, không là peer thực", differences: { size: "Quy mô khác", growth: "Chưa đối chiếu", profitability: "Chưa đối chiếu", capitalStructure: "Chưa đối chiếu" } }));
  await page.getByLabel("JSON doanh nghiệp so sánh", { exact: true }).fill(JSON.stringify(peers));
  await page.getByRole("button", { name: "Kiểm tra danh sách so sánh", exact: true }).click();
  await page.getByRole("button", { name: "Áp dụng trung vị P/E", exact: true }).click();
  await expect(page.getByLabel("Base · P/E tham chiếu", { exact: true })).toHaveValue("15");
  await expect(page.getByRole("button", { name: "Áp dụng trung vị P/B", exact: true })).toBeDisabled();
});
