import { describe, expect, it } from "vitest";
import { normalizeBaseUrl } from "../url";

describe("normalizeBaseUrl", () => {
  it("removes trailing slashes from base URLs", () => {
    expect(normalizeBaseUrl("https://example.convex.site/")).toBe(
      "https://example.convex.site",
    );
    expect(normalizeBaseUrl("http://localhost:3547///")).toBe(
      "http://localhost:3547",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeBaseUrl("  https://example.com  ")).toBe(
      "https://example.com",
    );
  });
});
