import { describe, expect, it } from "vitest";
import { getSafeRedirectUrl } from "../validate-redirect";

describe("getSafeRedirectUrl", () => {
  it("returns '/' when url is undefined", () => {
    expect(getSafeRedirectUrl(undefined)).toBe("/");
  });

  it("returns '/' when url is null", () => {
    expect(getSafeRedirectUrl(null)).toBe("/");
  });

  it("returns '/' when url is an empty string", () => {
    expect(getSafeRedirectUrl("")).toBe("/");
  });

  it("returns the explicit relative path when provided", () => {
    expect(getSafeRedirectUrl("/explicit-next")).toBe("/explicit-next");
  });

  it("returns the fallback '/' when url is an unsafe absolute URL", () => {
    expect(getSafeRedirectUrl("https://evil.com/pwn")).toBe("/");
  });
});
