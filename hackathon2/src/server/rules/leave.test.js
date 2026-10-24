import { describe, expect, test } from "vitest";
import { countLeaveDays } from "./leaveDays";

const rules = { weekendDays: [0, 6], holidays: [] };

describe("countLeaveDays", () => {
  test("Fri 23 Oct to Mon 26 Oct 2026 skips the weekend", () => {
    expect(countLeaveDays("2026-10-23", "2026-10-26", rules)).toBe(2);
  });

  test("a holiday inside the range is skipped", () => {
    expect(countLeaveDays("2026-12-21", "2026-12-25", { ...rules, holidays: ["2026-12-25"] })).toBe(4);
  });

  test("a weekend-only range is 0 days", () => {
    expect(countLeaveDays("2026-10-24", "2026-10-25", rules)).toBe(0);
  });

  test("start after end is 0 days", () => {
    expect(countLeaveDays("2026-10-27", "2026-10-26", rules)).toBe(0);
  });

  test("a single working day is 1 day", () => {
    expect(countLeaveDays("2026-10-26", "2026-10-26", rules)).toBe(1);
  });

  test("a Sunday-only weekend counts Saturday", () => {
    expect(countLeaveDays("2026-10-23", "2026-10-26", { weekendDays: [0], holidays: [] })).toBe(3);
  });
});
