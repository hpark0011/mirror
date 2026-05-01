import { describe, expect, it } from "vitest";
import { sanitizeContent } from "../lib/sanitize-content";

function imageBody(attrs: Record<string, unknown>) {
  return {
    type: "doc",
    content: [
      {
        type: "image",
        attrs,
      },
    ],
  };
}

describe("sanitizeContent storageId handling (FR-04)", () => {
  it("preserves a valid lowercase-alphanumeric storageId", () => {
    const sanitized = sanitizeContent(
      imageBody({ src: "https://example.com/a.png", storageId: "abcdef0123456789" }),
    );
    expect(sanitized.content?.[0]?.attrs?.storageId).toBe("abcdef0123456789");
  });

  it("preserves a mixed-case alphanumeric + hyphen + underscore storageId", () => {
    const sanitized = sanitizeContent(
      imageBody({ src: "https://example.com/a.png", storageId: "abcDEF_123-xyz" }),
    );
    expect(sanitized.content?.[0]?.attrs?.storageId).toBe("abcDEF_123-xyz");
  });

  it("strips a storageId containing an HTML/script payload", () => {
    const sanitized = sanitizeContent(
      imageBody({
        src: "https://example.com/a.png",
        storageId: "<script>alert(1)</script>",
      }),
    );
    expect(sanitized.content?.[0]?.attrs?.storageId).toBeUndefined();
    // src is still preserved
    expect(sanitized.content?.[0]?.attrs?.src).toBe("https://example.com/a.png");
  });

  it("strips a storageId containing whitespace", () => {
    const sanitized = sanitizeContent(
      imageBody({
        src: "https://example.com/a.png",
        storageId: "abc 123",
      }),
    );
    expect(sanitized.content?.[0]?.attrs?.storageId).toBeUndefined();
  });

  it("strips a storageId containing a path traversal sequence", () => {
    const sanitized = sanitizeContent(
      imageBody({
        src: "https://example.com/a.png",
        storageId: "../etc/passwd",
      }),
    );
    expect(sanitized.content?.[0]?.attrs?.storageId).toBeUndefined();
  });

  it("strips a non-string storageId", () => {
    const sanitized = sanitizeContent(
      imageBody({
        src: "https://example.com/a.png",
        storageId: 12345,
      }),
    );
    expect(sanitized.content?.[0]?.attrs?.storageId).toBeUndefined();
  });

  it("strips storageId when value is empty string", () => {
    // Locks in the `+` (one-or-more) vs `*` (zero-or-more) distinction in
    // the STORAGE_ID_PATTERN regex — an empty string must NOT validate.
    const input = imageBody({ src: "https://x/y.png", storageId: "" });
    const out = sanitizeContent(input);
    expect(out.content?.[0]?.attrs?.storageId).toBeUndefined();
    // sibling attrs should still survive
    expect(out.content?.[0]?.attrs?.src).toBe("https://x/y.png");
  });

  it("preserves storageId alongside the existing alt and title attrs", () => {
    const sanitized = sanitizeContent(
      imageBody({
        src: "https://example.com/a.png",
        alt: "alt text",
        title: "the title",
        storageId: "good_id-1",
      }),
    );
    const attrs = sanitized.content?.[0]?.attrs;
    expect(attrs?.storageId).toBe("good_id-1");
    expect(attrs?.alt).toBe("alt text");
    expect(attrs?.title).toBe("the title");
  });
});
