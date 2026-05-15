import { describe, expect, it } from "vitest";
import { monthYearToEpochMs } from "@/features/projects/utils/month-year";

describe("monthYearToEpochMs", () => {
  it("converts a valid month and year to first-of-month UTC", () => {
    expect(monthYearToEpochMs(5, 2025)).toBe(Date.UTC(2025, 4, 1, 0, 0, 0, 0));
  });

  it("rejects out-of-range months before Date.UTC can normalize them", () => {
    expect(() => monthYearToEpochMs(0, 2025)).toThrow(RangeError);
    expect(() => monthYearToEpochMs(13, 2025)).toThrow(RangeError);
  });
});
