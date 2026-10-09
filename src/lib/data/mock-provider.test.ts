import { describe, expect, it } from "vitest";
import {
  marketHistory,
  marketIndices,
  mockProvider,
  stocks,
} from "./mock-provider";
describe("mock provider data boundary", () => {
  it("labels all stocks with mock provenance and a parseable illustrative timestamp", () => {
    for (const stock of stocks) {
      expect(stock.provenance.kind).toBe("mock");
      expect(stock.provenance.source).toContain("minh họa");
      expect(Number.isFinite(Date.parse(stock.provenance.asOf))).toBe(true);
      expect(stock.prices.at(-1)?.price).toBe(stock.price);
    }
    expect(marketHistory.at(-1)?.price).toBe(marketIndices[0].value);
  });
  it("finds symbols case-insensitively and does not invent missing stocks", async () => {
    expect((await mockProvider.getStock("fpt"))?.symbol).toBe("FPT");
    expect(await mockProvider.getStock("ZZZ")).toBeNull();
    expect(await mockProvider.searchStocks("  vnm ")).toHaveLength(1);
    expect(await mockProvider.searchStocks("unknown-company")).toEqual([]);
  });
  it("keeps historical observations chronological, finite and distinct", () => {
    for (const stock of stocks) {
      expect(new Set(stock.prices.map((p) => p.date)).size).toBe(
        stock.prices.length,
      );
      expect(stock.prices.map((p) => p.date)).toEqual(
        stock.prices.map((p) => p.date).sort(),
      );
      expect(
        stock.prices.every((p) => Number.isFinite(p.price) && p.price > 0),
      ).toBe(true);
    }
  });
});
