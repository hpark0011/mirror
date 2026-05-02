import { describe, expect, it } from "vitest";
import { formatDateRange } from "../lib/format-date-range";

function utc(year: number, month1Indexed: number): number {
  return Date.UTC(year, month1Indexed - 1, 1, 0, 0, 0, 0);
}

describe("formatDateRange", () => {
  it("renders 'Jan 2022 – Present' when end is null", () => {
    expect(formatDateRange(utc(2022, 1), null)).toBe("Jan 2022 – Present");
  });

  it("renders 'Jan 2022 – Mar 2024' when both set and different months", () => {
    expect(formatDateRange(utc(2022, 1), utc(2024, 3))).toBe(
      "Jan 2022 – Mar 2024",
    );
  });

  it("renders 'Jan 2024' when start === end (single-month range)", () => {
    expect(formatDateRange(utc(2024, 1), utc(2024, 1))).toBe("Jan 2024");
  });

  it("uses the correct three-letter abbreviation for all 12 months", () => {
    const expected = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    for (let m = 1; m <= 12; m++) {
      expect(formatDateRange(utc(2020, m), null)).toBe(
        `${expected[m - 1]} 2020 – Present`,
      );
    }
  });

  it("anchors month derivation to UTC, not the local timezone", () => {
    // Storage convention: epoch ms is anchored to first-of-month UTC. If we
    // accidentally used `getMonth()` (local tz), east-of-UTC users would see
    // Dec 2021 for an entry stored as Jan 2022.
    const jan2022Utc = Date.UTC(2022, 0, 1, 0, 0, 0, 0);
    expect(formatDateRange(jan2022Utc, null)).toBe("Jan 2022 – Present");

    // Load-bearing UTC-anchor regression (issue L5): midnight-UTC on Jan 1 is
    // still Jan 1 in every UTC+ timezone, so the assertion above is vacuous on
    // a UTC test runner. 4am UTC on Jan 1 is still Jan 1 in UTC and UTC+, but
    // Dec 31 23:00 in `America/New_York` (UTC-5) — local-tz `getMonth()`
    // would return 11 (Dec) on a UTC- runner; `getUTCMonth()` correctly
    // returns 0 (Jan) on every runner.
    const jan2022UtcEarlyMorning = Date.UTC(2022, 0, 1, 4, 0, 0, 0);
    expect(formatDateRange(jan2022UtcEarlyMorning, null)).toBe(
      "Jan 2022 – Present",
    );
  });

  it("renders Dec correctly even when end is also Dec same year", () => {
    expect(formatDateRange(utc(2023, 12), utc(2023, 12))).toBe("Dec 2023");
  });

  it("renders cross-year ranges correctly", () => {
    expect(formatDateRange(utc(2014, 9), utc(2018, 5))).toBe(
      "Sep 2014 – May 2018",
    );
  });
});
