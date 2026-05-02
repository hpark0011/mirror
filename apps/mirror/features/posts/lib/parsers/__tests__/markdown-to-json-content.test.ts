// FR-09: `createMarkdownExtensions()` registers the Image extension so that
// `![alt](url)` markdown produces image nodes (these were previously dropped
// silently). The parser owns the entry point used by the import flow.
import { describe, expect, it } from "vitest";
import { markdownToJsonContent } from "../markdown-to-json-content";
import type { JSONContent } from "@feel-good/features/editor/types";

function findImageNode(node: JSONContent): JSONContent | null {
  if (node.type === "image") return node;
  if (!node.content) return null;
  for (const child of node.content) {
    const hit = findImageNode(child);
    if (hit) return hit;
  }
  return null;
}

describe("markdownToJsonContent (FR-09)", () => {
  it("produces an image node from `![alt](url)` markdown", () => {
    const body = markdownToJsonContent("![alt](https://x/y.png)");
    const image = findImageNode(body);
    expect(image).not.toBeNull();
    expect(image?.type).toBe("image");
    expect(image?.attrs?.src).toBe("https://x/y.png");
    // Markdown-imported images carry no storageId yet — the import action
    // fetches the URL and assigns one. Asserting absence locks in the
    // contract the action depends on.
    expect(image?.attrs?.storageId ?? null).toBeNull();
  });

  it("preserves the alt text on the parsed image node", () => {
    const body = markdownToJsonContent("![cover photo](https://x/y.png)");
    const image = findImageNode(body);
    expect(image?.attrs?.alt).toBe("cover photo");
  });

  it("returns an image-free body when the markdown has no images", () => {
    const body = markdownToJsonContent("Hello world.");
    expect(findImageNode(body)).toBeNull();
  });
});
