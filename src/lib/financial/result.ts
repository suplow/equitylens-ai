import type { Calculation, IssueCode } from "./types";
export function success<T>(value: T, warnings: string[] = []): Calculation<T> { return { ok: true, value, warnings }; }
export function failure<T = never>(code: IssueCode, ...issues: string[]): Calculation<T> { return { ok: false, value: null, code, issues, warnings: [] }; }
export function finiteResult(value: number): Calculation<number> {
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? success(value) : failure("invalid", "Kết quả vượt phạm vi số an toàn.");
}
