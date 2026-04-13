"use client";

import { Editor, type JSONContent } from "@tiptap/core";
import { createMarkdownExtensions } from "@feel-good/features/editor/lib";

export function markdownToJsonContent(markdown: string): JSONContent {
  const editor = new Editor({
    extensions: createMarkdownExtensions(),
    content: markdown,
  });
  try {
    return editor.getJSON();
  } finally {
    editor.destroy();
  }
}
