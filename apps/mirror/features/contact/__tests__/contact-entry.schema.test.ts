import { describe, expect, it } from "vitest";
import { contactEntrySchema } from "../lib/schemas/contact-entry.schema";

describe("contactEntrySchema", () => {
  describe("email kind", () => {
    it("accepts a valid email address", () => {
      const result = contactEntrySchema.safeParse({
        kind: "email",
        value: "hpark0011@gmail.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a malformed email", () => {
      const result = contactEntrySchema.safeParse({
        kind: "email",
        value: "not-an-email",
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0]!.path).toEqual(["value"]);
    });

    it("rejects an empty value", () => {
      const result = contactEntrySchema.safeParse({
        kind: "email",
        value: "",
      });
      expect(result.success).toBe(false);
    });

    it("trims whitespace before validating", () => {
      const result = contactEntrySchema.safeParse({
        kind: "email",
        value: "  hp@example.com  ",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("social kinds", () => {
    it.each([
      ["linkedin", "https://www.linkedin.com/in/hyunsolpark/"],
      ["instagram", "https://www.instagram.com/hyunsolpark/"],
      ["x", "https://x.com/hpark0011"],
      ["tiktok", "https://www.tiktok.com/@hp"],
      ["youtube", "https://www.youtube.com/@hp"],
    ] as const)("%s: accepts a valid https URL", (kind, value) => {
      const result = contactEntrySchema.safeParse({ kind, value });
      expect(result.success).toBe(true);
    });

    it("rejects http:// URLs (https-only)", () => {
      const result = contactEntrySchema.safeParse({
        kind: "linkedin",
        value: "http://example.com",
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0]!.message).toMatch(/https/);
      expect(result.error.issues[0]!.path).toEqual(["value"]);
    });

    it("rejects malformed URLs", () => {
      const result = contactEntrySchema.safeParse({
        kind: "linkedin",
        value: "not a url",
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues[0]!.path).toEqual(["value"]);
    });

    it("rejects an empty value", () => {
      const result = contactEntrySchema.safeParse({
        kind: "x",
        value: "",
      });
      expect(result.success).toBe(false);
    });
  });

  it("rejects unknown kinds", () => {
    const result = contactEntrySchema.safeParse({
      kind: "facebook",
      value: "https://facebook.com/someone",
    });
    expect(result.success).toBe(false);
  });
});
