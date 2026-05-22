import { describe, expect, it } from "vitest";
import {
  SCHEDULING_BOUNDS,
  SCHEDULING_DEFAULTS,
  assertValidIanaTimeZone,
  assertValidSchedulingBoundValue,
  assertValidSchedulingPreferences,
  isValidIanaTimeZone,
  isValidSchedulingBoundValue,
} from "../validators";

describe("isValidIanaTimeZone", () => {
  it("accepts canonical IANA identifiers", () => {
    expect(isValidIanaTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidIanaTimeZone("Europe/London")).toBe(true);
    expect(isValidIanaTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidIanaTimeZone("UTC")).toBe(true);
  });

  it("rejects empty, offsets, and bogus names", () => {
    expect(isValidIanaTimeZone("")).toBe(false);
    expect(isValidIanaTimeZone("+09:00")).toBe(false);
    expect(isValidIanaTimeZone("PST")).toBe(false);
    expect(isValidIanaTimeZone("Not/A_Zone")).toBe(false);
    expect(isValidIanaTimeZone(null)).toBe(false);
    expect(isValidIanaTimeZone(undefined)).toBe(false);
    expect(isValidIanaTimeZone(123)).toBe(false);
  });
});

describe("assertValidIanaTimeZone", () => {
  it("includes the field name in error messages", () => {
    expect(() => assertValidIanaTimeZone("bogus", "ownerTimeZone")).toThrow(
      /ownerTimeZone/,
    );
  });
});

describe("isValidSchedulingBoundValue", () => {
  it("enforces the documented bounds", () => {
    const cases: Array<{
      key: keyof typeof SCHEDULING_BOUNDS;
      good: number;
      tooSmall: number;
      tooLarge: number;
    }> = [
      { key: "defaultDurationMinutes", good: 30, tooSmall: 0, tooLarge: 9999 },
      { key: "minLeadTimeMinutes", good: 60, tooSmall: -1, tooLarge: 99999 },
      { key: "maxDaysAhead", good: 30, tooSmall: 0, tooLarge: 9999 },
      { key: "bufferMinutes", good: 15, tooSmall: -1, tooLarge: 9999 },
    ];
    for (const { key, good, tooSmall, tooLarge } of cases) {
      expect(isValidSchedulingBoundValue(key, good)).toBe(true);
      expect(isValidSchedulingBoundValue(key, tooSmall)).toBe(false);
      expect(isValidSchedulingBoundValue(key, tooLarge)).toBe(false);
      expect(isValidSchedulingBoundValue(key, "30" as unknown)).toBe(false);
      expect(isValidSchedulingBoundValue(key, 30.5)).toBe(false);
    }
  });
});

describe("assertValidSchedulingBoundValue", () => {
  it("throws with the bound in the message", () => {
    expect(() =>
      assertValidSchedulingBoundValue("defaultDurationMinutes", 9999),
    ).toThrow(/defaultDurationMinutes/);
    expect(() =>
      assertValidSchedulingBoundValue("defaultDurationMinutes", 9999),
    ).toThrow(/480/);
  });
});

describe("assertValidSchedulingPreferences", () => {
  const valid = {
    timeZone: "America/Los_Angeles",
    defaultDurationMinutes: SCHEDULING_DEFAULTS.defaultDurationMinutes,
    minLeadTimeMinutes: SCHEDULING_DEFAULTS.minLeadTimeMinutes,
    maxDaysAhead: SCHEDULING_DEFAULTS.maxDaysAhead,
    bufferMinutes: SCHEDULING_DEFAULTS.bufferMinutes,
  };

  it("accepts a fully valid preference object", () => {
    expect(() => assertValidSchedulingPreferences(valid)).not.toThrow();
  });

  it("throws on an invalid timezone", () => {
    expect(() =>
      assertValidSchedulingPreferences({ ...valid, timeZone: "PST" }),
    ).toThrow();
  });

  it("throws on an out-of-range duration", () => {
    expect(() =>
      assertValidSchedulingPreferences({
        ...valid,
        defaultDurationMinutes: 0,
      }),
    ).toThrow();
  });
});
