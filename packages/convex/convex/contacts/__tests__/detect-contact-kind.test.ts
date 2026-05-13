import { describe, expect, it } from "vitest";
import { CONTACT_ENTRY_KIND_VALUES } from "../schema";
import { detectContactKind, isContactEntryKind } from "../detectContactKind";

describe("detectContactKind", () => {
  it("returns only schema-supported contact kinds", () => {
    const samples = [
      "hello@example.com",
      "https://www.linkedin.com/in/example",
      "https://instagram.com/example",
      "https://twitter.com/example",
      "https://x.com/example",
      "https://tiktok.com/@example",
      "https://youtu.be/example",
    ];

    const detected = samples.map((sample) => detectContactKind(sample));

    expect(detected).toEqual([
      "email",
      "linkedin",
      "instagram",
      "x",
      "x",
      "tiktok",
      "youtube",
    ]);
    for (const kind of detected) {
      expect(kind).not.toBeNull();
      expect(isContactEntryKind(kind!)).toBe(true);
      expect(CONTACT_ENTRY_KIND_VALUES).toContain(kind!);
    }
  });

  it("does not emit unsupported social kinds", () => {
    expect(detectContactKind("https://bsky.app/profile/example")).toBeNull();
    expect(detectContactKind("https://example.com/profile")).toBeNull();
  });
});
