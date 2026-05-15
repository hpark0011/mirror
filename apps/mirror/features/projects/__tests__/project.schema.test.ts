import { describe, expect, it } from "vitest";
import { projectSchema } from "@/features/projects/lib/schemas/project.schema";

const baseValidValues = {
  title: "Realtime analytics dashboard",
  startMonth: 1,
  startYear: 2025,
  endMonth: null,
  endYear: null,
  description: "",
  link: "",
  coverImageStorageId: null,
  coverImageThumbhash: "",
  coverImageUrl: null,
  clearCover: false,
};

describe("projectSchema", () => {
  it("accepts an empty link string", () => {
    const result = projectSchema.safeParse(baseValidValues);
    expect(result.success).toBe(true);
  });

  it("accepts a valid https link", () => {
    const result = projectSchema.safeParse({
      ...baseValidValues,
      link: "https://example.com/project",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-https links", () => {
    const result = projectSchema.safeParse({
      ...baseValidValues,
      link: "http://example.com/project",
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed links", () => {
    const result = projectSchema.safeParse({
      ...baseValidValues,
      link: "not a url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects blank cover storage ids", () => {
    const result = projectSchema.safeParse({
      ...baseValidValues,
      coverImageStorageId: "",
    });
    expect(result.success).toBe(false);
  });
});
