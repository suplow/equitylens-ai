import { expect, it } from "vitest";
import { createDatasetTemplate } from "./schema";
import { defaultScenarios, evaluateScenario, operatingSensitivity } from "./valuation";
import type { CorporateDataset } from "./types";

it("checks operating sensitivities against independent constant/ramp FCFF arithmetic", () => {
  const d = createDatasetTemplate("TEST", "corporate", true) as CorporateDataset;
  d.reports[1].fields.operatingWorkingCapital.value = 0;
  const assumption = { ...defaultScenarios(true)[1], years: 2, growth: 0, ebitMargin: .2, taxRate: .2, depreciationRate: .05, capexRate: .05, workingCapitalRate: 0, wacc: .1, terminalGrowth: 0 };
  const cells = operatingSensitivity(d, "FY2025", assumption);
  expect(cells).toHaveLength(9);
  const ev = (key: string, value: number) => { const result = cells.find(c => c.key === key && Math.abs(c.value - value) < 1e-12)!.result; expect(result.ok).toBe(true); return result.ok ? result.value.enterpriseValue : NaN; };
  // Revenue 1.2bn; no net investment; NOPAT = 192m forever at 10% => EV 1.92bn.
  expect(ev("growth", 0)).toBeCloseTo(1_920_000_000, 4);
  // CAPEX +1% of revenue reduces FCFF by 12m forever => EV 1.8bn.
  expect(ev("capexRate", .06)).toBeCloseTo(1_800_000_000, 4);
  // EBIT margin +1pp adds 12m*(1-.2) => EV increases by 96m.
  expect(ev("ebitMargin", .21)).toBeCloseTo(2_016_000_000, 4);
  expect(ev("growth", .01)).toBeCloseTo(193_920_000 / 1.1 + 195_859_200 / 1.21 + 1_958_592_000 / 1.21, 4);
  const unchecked = evaluateScenario(d, "FY2025", assumption); expect(unchecked.warnings.join(" ")).toContain("Chưa xác nhận trạng thái ổn định");
  const checked = evaluateScenario(d, "FY2025", { ...assumption, stableState: { confirmed: true, rationale: "Educational constant reinvestment case" } });
  expect(checked.warnings.join(" ")).not.toContain("Chưa xác nhận trạng thái ổn định");
  const unsustainable = evaluateScenario(d, "FY2025", { ...assumption, terminalGrowth: .02 });
  expect(unsustainable.warnings.join(" ")).toContain("tái đầu tư hàm ý");
});
