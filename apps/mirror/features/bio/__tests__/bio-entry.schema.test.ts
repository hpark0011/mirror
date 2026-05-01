import { describe, expect, it } from "vitest";
import { bioEntrySchema } from "../lib/schemas/bio-entry.schema";

const baseValidValues = {
  kind: "work" as const,
  title: "Senior Engineer at Acme",
  startMonth: 1,
  startYear: 2022,
  endMonth: null,
  endYear: null,
  description: "",
  link: "",
};

describe("bioEntrySchema", () => {
  it("accepts a minimal valid entry with no end date", () => {
    const result = bioEntrySchema.safeParse(baseValidValues);
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only title (trimmed length is 0)", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      title: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title over 200 chars", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      title: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description over 500 chars", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      description: "y".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty link string (cleared field contract)", () => {
    const result = bioEntrySchema.safeParse({ ...baseValidValues, link: "" });
    expect(result.success).toBe(true);
  });

  it("rejects an http (non-https) URL", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      link: "http://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed URL", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      link: "not a url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid https URL", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      link: "https://example.com/blog/post",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null endMonth and endYear (= Present)", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      endMonth: null,
      endYear: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects partial end (month set but year null)", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      endMonth: 6,
      endYear: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      startMonth: 6,
      startYear: 2024,
      endMonth: 1,
      endYear: 2024,
    });
    expect(result.success).toBe(false);
  });

  it("accepts equal start and end dates (single-month range)", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      startMonth: 6,
      startYear: 2024,
      endMonth: 6,
      endYear: 2024,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a year before 1900", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      startYear: 1899,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a year more than one year in the future", () => {
    const tooFar = new Date().getUTCFullYear() + 2;
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      startYear: tooFar,
    });
    expect(result.success).toBe(false);
  });

  it("accepts current year + 1 (announce upcoming role)", () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      startYear: nextYear,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid month (0 or 13)", () => {
    expect(
      bioEntrySchema.safeParse({ ...baseValidValues, startMonth: 0 }).success,
    ).toBe(false);
    expect(
      bioEntrySchema.safeParse({ ...baseValidValues, startMonth: 13 }).success,
    ).toBe(false);
  });

  // FR-03 spec line 45: "schema rejects... missing startDate." Without this
  // the form could submit a partially-typed entry whose Convex
  // `v.number()` validator on `startDate` would silently NaN/throw.
  it.each([["startMonth"], ["startYear"]] as const)(
    "rejects when %s is missing",
    (field) => {
      const { [field]: _omitted, ...rest } = baseValidValues;
      void _omitted;
      const result = bioEntrySchema.safeParse(rest);
      expect(result.success).toBe(false);
    },
  );

  it("rejects an invalid kind", () => {
    const result = bioEntrySchema.safeParse({
      ...baseValidValues,
      kind: "hobby",
    });
    expect(result.success).toBe(false);
  });
});
