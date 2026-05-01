// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { createInlineImageExtension } from "../lib/inline-image-extension";

function makeEditor() {
  return new Editor({
    extensions: [StarterKit, createInlineImageExtension()],
    content: "<p></p>",
  });
}

describe("createInlineImageExtension", () => {
  it("preserves the base extension name", () => {
    const editor = makeEditor();
    const ext = editor.extensionManager.extensions.find((e) => e.name === "image");
    expect(ext).toBeDefined();
    editor.destroy();
  });

  it("parses storageId from data-storage-id HTML attribute", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      '<p>before</p><img src="https://example.com/a.png" data-storage-id="abc123_xyz-456" alt="x"/>',
    );
    const json = editor.getJSON();
    const image = findImageNode(json);
    expect(image?.attrs?.storageId).toBe("abc123_xyz-456");
    expect(image?.attrs?.src).toBe("https://example.com/a.png");
    editor.destroy();
  });

  it("renders storageId back to data-storage-id in HTML", () => {
    const editor = makeEditor();
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://example.com/a.png", storageId: "abc_DEF-123" },
        },
      ],
    });
    const html = editor.getHTML();
    expect(html).toContain('data-storage-id="abc_DEF-123"');
    expect(html).toContain('src="https://example.com/a.png"');
    editor.destroy();
  });

  it("round-trips storageId through HTML → JSON → HTML", () => {
    const editor = makeEditor();
    const original =
      '<img src="https://example.com/a.png" data-storage-id="round-trip_42" alt="r"/>';
    editor.commands.setContent(`<div>${original}</div>`);
    const json = editor.getJSON();
    editor.commands.setContent(json);
    const html = editor.getHTML();
    expect(html).toContain('data-storage-id="round-trip_42"');
    editor.destroy();
  });

  it("omits the data-storage-id attribute when storageId is null", () => {
    const editor = makeEditor();
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://example.com/a.png" },
        },
      ],
    });
    const html = editor.getHTML();
    expect(html).not.toContain("data-storage-id");
    editor.destroy();
  });
});

type Json = { type?: string; attrs?: Record<string, unknown>; content?: Json[] };

function findImageNode(node: Json): Json | null {
  if (node.type === "image") return node;
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const found = findImageNode(child);
      if (found) return found;
    }
  }
  return null;
}
