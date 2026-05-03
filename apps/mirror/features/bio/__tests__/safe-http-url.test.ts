import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "../lib/safe-http-url";

describe("safeHttpUrl", () => {
  it("returns the URL unchanged for http and https", () => {
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com");
    expect(safeHttpUrl("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("trims surrounding whitespace before validating", () => {
    expect(safeHttpUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("rejects javascript:, data:, file:, and other non-http(s) schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
    expect(safeHttpUrl("ftp://example.com")).toBeNull();
  });

  it("rejects unparseable strings", () => {
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("example.com")).toBeNull();
  });

  it("returns null for empty, whitespace-only, null, and undefined input", () => {
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });
});
