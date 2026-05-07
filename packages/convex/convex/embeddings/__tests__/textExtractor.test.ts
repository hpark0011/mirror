import { describe, expect, it } from "vitest";
import { extractPlainText } from "../textExtractor";

describe("extractPlainText", () => {
  it("returns alt text for an image node", () => {
    const body = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://example.com/img.png", alt: "A graph showing X" },
        },
      ],
    };
    const result = extractPlainText(body);
    expect(result).toContain("A graph showing X");
  });

  it("includes title alongside alt when both are present", () => {
    const node = {
      type: "image",
      attrs: { alt: "Revenue growth chart", title: "Q4 2024" },
    };
    const result = extractPlainText(node);
    expect(result).toBe("Revenue growth chart Q4 2024");
  });

  it("returns only alt when title is absent", () => {
    const node = {
      type: "image",
      attrs: { alt: "Architecture diagram", src: "https://example.com/arch.png" },
    };
    expect(extractPlainText(node)).toBe("Architecture diagram");
  });

  it("returns only title when alt is absent", () => {
    const node = {
      type: "image",
      attrs: { title: "My caption" },
    };
    expect(extractPlainText(node)).toBe("My caption");
  });

  it("returns empty string when both alt and title are absent", () => {
    const node = {
      type: "image",
      attrs: { src: "https://example.com/img.png" },
    };
    expect(extractPlainText(node)).toBe("");
  });

  it("returns empty string for an image node with no attrs", () => {
    const node = { type: "image" };
    expect(extractPlainText(node)).toBe("");
  });

  it("does not introduce 'undefined' strings for missing fields", () => {
    const node = { type: "image", attrs: { alt: undefined, title: undefined } };
    const result = extractPlainText(node);
    expect(result).not.toContain("undefined");
    expect(result).toBe("");
  });

  it("extracts text from a prose-only body without regression", () => {
    const body = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    const result = extractPlainText(body);
    expect(result).toContain("Hello world");
  });

  it("extracts image alt alongside surrounding prose", () => {
    const body = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "See below:" }],
        },
        {
          type: "image",
          attrs: { alt: "A graph showing revenue growth 2020-2024" },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "End of section." }],
        },
      ],
    };
    const result = extractPlainText(body);
    expect(result).toContain("See below:");
    expect(result).toContain("A graph showing revenue growth 2020-2024");
    expect(result).toContain("End of section.");
  });
});
