/**
 * Server-side plain text extractor for Tiptap JSONContent.
 * Inline type to avoid dependency on @tiptap/core.
 */
type JSONContent = {
  type?: string;
  text?: string;
  content?: JSONContent[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export function extractPlainText(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (!node.content || node.content.length === 0) {
    return "";
  }

  const childTexts = node.content.map((child) => extractPlainText(child));

  // Block-level nodes get newlines between them
  const blockTypes = new Set([
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "bulletList",
    "orderedList",
    "listItem",
    "horizontalRule",
  ]);

  if (blockTypes.has(node.type ?? "")) {
    return childTexts.join("") + "\n\n";
  }

  return childTexts.join("");
}

export type { JSONContent };
