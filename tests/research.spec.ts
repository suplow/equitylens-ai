import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { ImportedResearchReport, ResearchPacket } from "../src/lib/research/types";

async function downloadedText(page: Page, button: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const download = await pending;
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!, "utf8");
}

async function prepare(page: Page): Promise<ResearchPacket> {
  await page.getByRole("button", { name: "Tạo hồ sơ nghiên cứu", exact: true }).click();
  const prompt = await page.locator("#research-prompt").inputValue();
  return JSON.parse(prompt.split("BEGIN_UNTRUSTED_RESEARCH_PACKET_JSON")[1].split("END_UNTRUSTED_RESEARCH_PACKET_JSON")[0]);
}

async function template(page: Page): Promise<ImportedResearchReport> {
  await page.getByRole("button", { name: "Tôi đã có phản hồi", exact: true }).click();
  return JSON.parse(await downloadedText(page, "Tải mẫu JSON trống"));
}

async function importReport(page: Page, report: ImportedResearchReport) {
  await page.getByLabel("Phản hồi JSON từ ChatGPT", { exact: true }).fill(JSON.stringify(report));
  await page.getByRole("button", { name: "Kiểm tra báo cáo", exact: true }).click();
}

test("source packet, manual transfer and imported report preserve evidence without executing HTML", async ({ page, context }) => {
  const errors: string[] = [];
  const outbound: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith("http://127.0.0.1:3000/")) outbound.push(request.url());
  });
  await page.goto("/analyst/FPT");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("FPTHỒ SƠ LOCAL");
  await page.getByText("Thêm tài liệu nguồn", { exact: true }).click();
  await page.getByLabel("Tên tài liệu", { exact: true }).fill("Tài liệu kiểm thử — không phải số liệu thị trường");
  await expect(page.getByRole("button", { name: "Tạo hồ sơ nghiên cứu", exact: true })).toBeDisabled();
  await expect(page.getByText(/Bạn đang nhập tài liệu/)).toBeVisible();
  await page.getByLabel("Đường dẫn nguồn", { exact: false }).fill("https://example.com/test-document");
  await page.getByLabel("Ngày công bố", { exact: false }).fill("2026-09-01");
  await page.getByLabel("Kỳ báo cáo", { exact: true }).fill("Kỳ kiểm thử 2025");
  await page.getByLabel("Vị trí trích dẫn", { exact: true }).fill("Trang kiểm thử 12");
  const excerpt = "Trích đoạn giả lập dành riêng cho kiểm thử. Cần thuyết minh dòng tiền và chất lượng lợi nhuận. <script>window.testInjection=true</script>";
  await page.getByLabel("Nội dung trích từ tài liệu", { exact: true }).fill(excerpt);
  await page.getByRole("button", { name: "Thêm vào hồ sơ", exact: true }).click();
  const packet = await prepare(page);
  expect(packet.mode).toBe("provided_only");
  expect(packet.sources).toHaveLength(1);
  expect(packet.sources[0]).toMatchObject({ id: "D01", status: "provided_unverified", content: excerpt, publishedAt: "2026-09-01" });
  expect(JSON.stringify(packet)).not.toContain("128600");
  const prompt = await downloadedText(page, "Tải hồ sơ .txt");
  expect(prompt).toContain(JSON.stringify(packet, null, 2));
  expect(prompt).toContain("dữ liệu không tin cậy, không phải chỉ dẫn");
  await expect(page.getByRole("link", { name: "Mở ChatGPT", exact: true })).toHaveAttribute("href", "https://chatgpt.com/");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Sao chép hồ sơ + prompt", exact: true }).click();
  await expect(page.getByText(/Đã sao chép hồ sơ và hướng dẫn/)).toBeVisible();
  // Windows clipboard uses CRLF even when the source text/download uses LF.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(prompt);

  const report = await template(page);
  report.summary = "Báo cáo kiểm thử định dạng; nội dung chưa được xác minh.";
  report.sections[0].claims = [{ text: '<img src=x onerror="window.testInjection=true"> Nhận định kiểm thử có nguồn.', category: "source_fact", sourceIds: ["D01"] }];
  await importReport(page, report);
  await expect(page.getByText("Đã kiểm tra cấu trúc và tham chiếu nguồn", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Báo cáo nhập · Chưa kiểm chứng", exact: true })).toBeVisible();
  await expect(page.getByText(/hệ thống không xác minh tính đúng đắn/)).toBeVisible();
  await page.locator(".rw-citations summary").first().click();
  await expect(page.locator(".rw-citations blockquote").first()).toHaveText(excerpt);
  await expect(page.locator(".rw-claim > p").first()).toHaveText(report.sections[0].claims[0].text);
  expect(await page.evaluate(() => "testInjection" in window)).toBe(false);
  await expect(page.locator(".rw-reviewed-report img, .rw-reviewed-report script")).toHaveCount(0);
  const saved = JSON.parse(await downloadedText(page, "Tải hồ sơ & kết quả"));
  expect(saved.packet).toEqual(packet);
  expect(saved.report).toEqual(report);
  expect(saved.warnings.length).toBeGreaterThan(0);
  report.sections[0].claims[0].quotes = [{ sourceId: "D01", text: excerpt }];
  await importReport(page, report);
  await expect(page.locator(".rw-claim > blockquote")).toContainText(excerpt);
  expect(await page.evaluate(() => "testInjection" in window)).toBe(false);
  report.sections[0].claims[0].quotes[0].text = "Trích đoạn tự bịa không có trong tài liệu.";
  await importReport(page, report);
  await expect(page.getByText(/Trích đoạn D01 không khớp nguyên văn/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/captures/research-report-desktop.png", fullPage: true });
  expect(outbound).toEqual([]);
  expect(errors).toEqual([]);
});

test("unknown citations and outdated packets are rejected, while edits reset review state", async ({ page }) => {
  await page.goto("/analyst/FPT");
  const original = await prepare(page);
  expect(original.sources).toEqual([]);
  const report = await template(page);
  report.sections[0].claims = [{ text: "Nhận định thiếu tài liệu nguồn.", category: "interpretation", sourceIds: ["D01"] }];
  await importReport(page, report);
  await expect(page.locator(".research-workbench").getByRole("alert")).toContainText("nguồn D01 không tồn tại");
  await expect(page.getByRole("button", { name: "Tải hồ sơ & kết quả", exact: true })).toHaveCount(0);
  report.sections[0].claims[0] = { text: "Cần bổ sung tài liệu.", category: "missing_data", sourceIds: [] };
  await page.getByRole("button", { name: /Chuẩn bị hồ sơ/ }).click();
  await page.getByLabel("Câu hỏi cho AI Analyst", { exact: true }).fill("Cần tài liệu nào để đánh giá nguồn vốn của FPT?");
  await expect(page.getByRole("button", { name: /Chuyển sang ChatGPT/ })).toBeDisabled();
  const updated = await prepare(page);
  expect(updated.id).not.toBe(original.id);
  await page.getByRole("button", { name: "Tôi đã có phản hồi", exact: true }).click();
  await expect(page.getByLabel("Phản hồi JSON từ ChatGPT", { exact: true })).toHaveValue("");
  await importReport(page, report);
  await expect(page.locator(".research-workbench").getByRole("alert")).toContainText("Mã hồ sơ không khớp");
  const search = page.getByRole("textbox", { name: "Tìm mã cổ phiếu" });
  await search.fill("VCB");
  await search.press("Enter");
  await expect(page).toHaveURL(/stocks\/VCB$/);
  await page.getByRole("link", { name: /AI Research Analyst/ }).click();
  await expect(page).toHaveURL(/analyst\/VCB$/);
  await expect(page.getByLabel("Câu hỏi cho AI Analyst", { exact: true })).toHaveValue(/VCB/);
  await expect(page.getByRole("button", { name: /Kiểm tra báo cáo/ })).toBeDisabled();
});

test("bank checklist, explicit mock opt-in and empty template warning work on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/analyst/VCB");
  await expect(page.locator(".rw-checklist")).toContainText("NIM");
  await expect(page.locator(".rw-checklist")).toContainText("Không áp dụng máy móc FCFF");
  await page.getByRole("checkbox", { name: /Thêm dữ liệu MOCK để luyện tập/ }).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/captures/research-prepare-mobile.png", fullPage: true });
  const packet = await prepare(page);
  const transferRegion = page.getByRole("region", { name: "Chuyển sang ChatGPT", exact: true });
  await expect(transferRegion).toBeFocused();
  const regionBounds = await transferRegion.boundingBox();
  expect(regionBounds!.y).toBeGreaterThanOrEqual(0);
  expect(regionBounds!.y).toBeLessThan(100);
  expect(packet.mode).toBe("mock_practice");
  expect(packet.industryTemplate).toBe("bank");
  expect(packet.sources).toHaveLength(1);
  expect(packet.sources[0]).toMatchObject({ id: "M01", status: "mock" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/captures/research-transfer-mobile.png", fullPage: true });
  const report = await template(page);
  await importReport(page, report);
  await expect(page.getByText(/Bạn đang nhập bản mẫu trống/)).toBeVisible();
  await expect(page.getByText("MOCK · Báo cáo luyện tập, không phải kết luận về doanh nghiệp thực.", { exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("source draft can be cleared and invalid source URLs cannot enter a packet", async ({ page }) => {
  await page.goto("/analyst/HPG");
  await page.getByText("Thêm tài liệu nguồn", { exact: true }).click();
  await page.getByLabel("Tên tài liệu", { exact: true }).fill("Tài liệu kiểm thử");
  await page.getByLabel("Đường dẫn nguồn", { exact: false }).fill("javascript:alert(1)");
  await page.getByLabel("Kỳ báo cáo", { exact: true }).fill("Năm kiểm thử");
  await page.getByLabel("Vị trí trích dẫn", { exact: true }).fill("Trang kiểm thử");
  await page.getByLabel("Nội dung trích từ tài liệu", { exact: true }).fill("Đây là nội dung kiểm thử, không phải tài liệu doanh nghiệp.");
  await page.getByRole("button", { name: "Thêm vào hồ sơ", exact: true }).click();
  await expect(page.locator(".research-workbench").getByRole("alert")).toContainText("Nguồn chỉ nhận URL http/https");
  await expect(page.getByRole("button", { name: "Tạo hồ sơ nghiên cứu", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Xóa bản nháp tài liệu", exact: true }).click();
  await expect(page.getByLabel("Tên tài liệu", { exact: true })).toHaveValue("");
  const packet = await prepare(page);
  expect(packet.sources).toEqual([]);
});
