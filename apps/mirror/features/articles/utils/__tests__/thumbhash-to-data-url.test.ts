import { describe, expect, it } from "vitest";
import { thumbhashToDataUrl } from "../thumbhash-to-data-url";

const KNOWN_THUMBHASH = "1QcSHQRnh493V4dIh4eXh1h4kJUI";

describe("thumbhashToDataUrl", () => {
  it("returns null for null input", () => {
    expect(thumbhashToDataUrl(null)).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(thumbhashToDataUrl("")).toBeNull();
  });
  it("returns a PNG data URL for a valid thumbhash", () => {
    const url = thumbhashToDataUrl(KNOWN_THUMBHASH);
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(url!.length).toBeGreaterThan(100);
  });
  it("returns null for a malformed thumbhash instead of throwing", () => {
    expect(thumbhashToDataUrl("!!!not-base64!!!")).toBeNull();
  });
});
