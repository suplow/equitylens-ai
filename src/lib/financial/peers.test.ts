import { describe, expect, it } from "vitest";
import { parsePeers, peerMedian, type PeerInput } from "./peers";
const peer: PeerInput = { symbol: "DEMO", industry: "corporate", period: "FY2025", source: { title: "MOCK test source", url: "https://example.com/peers", asOf: "2026-03-31", provenance: "mock" }, pe: 10, pb: 2, evEbitda: null, selectionReason: "Mock peer for testing only", differences: { size: "Unknown", growth: "Unknown", profitability: "Unknown", capitalStructure: "Unknown" } };
describe("explicit peer inputs", () => {
  it("validates provenance and computes a median without inventing missing multiples", () => {
    expect(parsePeers(JSON.stringify([peer])).ok).toBe(true);
    const peers = [peer, { ...peer, symbol: "TEST", pe: 14 }, { ...peer, symbol: "NONE", pe: null }];
    expect(peerMedian(peers, "pe", "corporate", "FY2025")).toMatchObject({ ok: true, value: 12 });
    expect(peerMedian(peers, "evEbitda", "corporate", "FY2025").ok).toBe(false);
  });
  it("requires matching period and industry and rejects unsupported institutions", () => {
    expect(peerMedian([peer], "pe", "corporate", "FY2024").ok).toBe(false);
    expect(peerMedian([peer], "pb", "bank", "FY2025").ok).toBe(false);
    expect(peerMedian([], "pe", "corporate", "FY2025").ok).toBe(false);
  });
  it("rejects duplicates, negative multiples, malicious URLs and claimed verification", () => {
    expect(parsePeers(JSON.stringify([peer, peer])).ok).toBe(false);
    expect(parsePeers(JSON.stringify([{ ...peer, pe: -1 }])).ok).toBe(false);
    expect(parsePeers(JSON.stringify([{ ...peer, source: { ...peer.source, url: "javascript:alert(1)" } }])).ok).toBe(false);
    expect(parsePeers(JSON.stringify([{ ...peer, verified: true }])).ok).toBe(false);
  });
});
