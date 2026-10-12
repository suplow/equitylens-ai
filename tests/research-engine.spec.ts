import { test, expect } from "@playwright/test";
import input from "../src/lib/financial/fixtures/stable.input.json";

test("saved financial data enters research packet with calculated ratios and mock warnings", async ({ page }) => {
  await page.addInitScript(data => localStorage.setItem("equitylens.financial.v2.FPT", JSON.stringify(data)), { ...input, symbol: "FPT" });
  await page.goto("/analyst/FPT");
  await page.getByText("Đính kèm Financial Engine", { exact: true }).click();
  await page.getByRole("button", { name: "Nạp dữ liệu tài chính đã lưu", exact: true }).click();
  await page.getByRole("combobox", { name: "Kỳ Financial Engine", exact: true }).selectOption("FY2025");
  await page.getByLabel("Đưa kết quả Financial Engine vào hồ sơ", { exact: true }).check();
  await page.getByRole("button", { name: "Tạo hồ sơ nghiên cứu", exact: true }).click();
  const prompt = await page.locator("#research-prompt").inputValue();
  const packet = JSON.parse(prompt.split("BEGIN_UNTRUSTED_RESEARCH_PACKET_JSON")[1].split("END_UNTRUSTED_RESEARCH_PACKET_JSON")[0]);
  expect(packet.mode).toBe("mock_practice");
  expect(packet.financialEvidence.ratios.find((r: { id: string }) => r.id === "grossMargin").result.value).toBe(0.4);
  expect(packet.financialEvidence.verification).toBe("not_performed");
  expect(packet.financialEvidence.valuation).toEqual([]);
  await expect(page.getByText("MOCK · LUYỆN TẬP", { exact: true })).toBeVisible();
});
