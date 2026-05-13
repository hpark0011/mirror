import { describe, expect, it } from "vitest";
import { serializeContactEntryForEmbedding } from "../serializeForEmbedding";

describe("serializeContactEntryForEmbedding", () => {
  it("produces 'Email address: …' prose for email kind", () => {
    expect(
      serializeContactEntryForEmbedding({
        kind: "email",
        value: "hpark0011@gmail.com",
      }),
    ).toBe("Email address: hpark0011@gmail.com.");
  });

  it("uses 'LinkedIn profile: …' prose for linkedin kind", () => {
    expect(
      serializeContactEntryForEmbedding({
        kind: "linkedin",
        value: "https://www.linkedin.com/in/hyunsolpark/",
      }),
    ).toBe(
      "LinkedIn profile: https://www.linkedin.com/in/hyunsolpark/.",
    );
  });

  it("uses 'Instagram profile: …' prose for instagram kind", () => {
    expect(
      serializeContactEntryForEmbedding({
        kind: "instagram",
        value: "https://www.instagram.com/hyunsolpark/",
      }),
    ).toBe(
      "Instagram profile: https://www.instagram.com/hyunsolpark/.",
    );
  });

  it("uses 'X profile: …' prose for x kind", () => {
    expect(
      serializeContactEntryForEmbedding({
        kind: "x",
        value: "https://x.com/hpark0011",
      }),
    ).toBe("X profile: https://x.com/hpark0011.");
  });

  it("uses 'TikTok profile: …' prose for tiktok kind", () => {
    expect(
      serializeContactEntryForEmbedding({
        kind: "tiktok",
        value: "https://www.tiktok.com/@hp",
      }),
    ).toBe("TikTok profile: https://www.tiktok.com/@hp.");
  });

  it("uses 'YouTube channel: …' prose for youtube kind", () => {
    expect(
      serializeContactEntryForEmbedding({
        kind: "youtube",
        value: "https://www.youtube.com/@hp",
      }),
    ).toBe("YouTube channel: https://www.youtube.com/@hp.");
  });

  it("trims leading/trailing whitespace from value before embedding", () => {
    expect(
      serializeContactEntryForEmbedding({
        kind: "email",
        value: "  hpark0011@gmail.com  ",
      }),
    ).toBe("Email address: hpark0011@gmail.com.");
  });
});
