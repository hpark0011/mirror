import type { JSONContent } from "@tiptap/core";

/**
 * WeakMap cache for memoizing plain text extraction results.
 * Keyed by JSONContent object reference to optimize repeated extractions
 * during search queries on the same article body.
 */
const plainTextCache = new WeakMap<JSONContent, string>();

/**
 * Recursively extracts all text content from a Tiptap JSONContent tree.
 * Used for search indexing and plain-text representations.
 *
 * Results are cached at the top level (outer call) to optimize repeated
 * extractions of the same article body during search operations.
 */
export function getPlainText(content: JSONContent): string {
  // Check cache first
  const cached = plainTextCache.get(content);
  if (cached !== undefined) return cached;

  const result = extractPlainText(content);
  plainTextCache.set(content, result);
  return result;
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "horizontalRule",
]);

/**
 * Internal recursive extraction logic.
 * Handles the actual text traversal without caching.
 */
function extractPlainText(content: JSONContent): string {
  if (content.text) {
    return content.text;
  }

  if (!content.content) {
    return "";
  }

  return content.content
    .map((node) => {
      const text = extractPlainText(node);
      return BLOCK_TYPES.has(node.type!) ? `${text}\n` : text;
    })
    .join("")
    .trim();
}
