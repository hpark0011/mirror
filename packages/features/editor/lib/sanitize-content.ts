import type { JSONContent } from "@tiptap/core";

/**
 * Allowed URL schemes for href and src attributes.
 * Blocks javascript:, data:, vbscript:, and other dangerous schemes.
 */
const SAFE_URL_PATTERN = /^(https?:|mailto:|\/|#)/i;

/** Node types that the article viewer is allowed to render. */
const ALLOWED_NODE_TYPES = new Set([
  "doc",
  "text",
  "paragraph",
  "heading",
  "image",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
]);

/** Mark types that the article viewer is allowed to render. */
const ALLOWED_MARK_TYPES = new Set(["bold", "italic", "code", "link"]);

/** Attributes allowed per node type. Unlisted node types get no attrs. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  heading: new Set(["level"]),
  image: new Set(["src", "alt", "title"]),
  codeBlock: new Set(["language"]),
  orderedList: new Set(["start"]),
};

/** Attributes allowed per mark type. */
const ALLOWED_MARK_ATTRS: Record<string, Set<string>> = {
  link: new Set(["href", "target", "rel"]),
};

function isSafeUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  // Strip whitespace and control characters that could bypass the check
  const trimmed = url.replace(/[\s\x00-\x1f]/g, "");
  return SAFE_URL_PATTERN.test(trimmed);
}

function sanitizeAttrs(
  nodeType: string,
  attrs: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!attrs) return undefined;

  const allowed = ALLOWED_ATTRS[nodeType];
  if (!allowed) return undefined;

  const sanitized: Record<string, unknown> = {};
  let hasKeys = false;

  for (const key of allowed) {
    if (key in attrs) {
      const value = attrs[key];

      // Validate URL-bearing attributes
      if (key === "src" && !isSafeUrl(value)) continue;

      sanitized[key] = value;
      hasKeys = true;
    }
  }

  return hasKeys ? sanitized : undefined;
}

function sanitizeMarkAttrs(
  markType: string,
  attrs: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!attrs) return undefined;

  const allowed = ALLOWED_MARK_ATTRS[markType];
  if (!allowed) return undefined;

  const sanitized: Record<string, unknown> = {};
  let hasKeys = false;

  for (const key of allowed) {
    if (key in attrs) {
      const value = attrs[key];

      // Validate URL-bearing attributes
      if (key === "href" && !isSafeUrl(value)) continue;

      sanitized[key] = value;
      hasKeys = true;
    }
  }

  return hasKeys ? sanitized : undefined;
}

function sanitizeMarks(
  marks: JSONContent["marks"],
): JSONContent["marks"] | undefined {
  if (!marks || !Array.isArray(marks)) return undefined;

  const sanitized = marks
    .filter((mark) => typeof mark.type === "string" && ALLOWED_MARK_TYPES.has(mark.type))
    .map((mark) => {
      const result: { type: string; attrs?: Record<string, unknown> } = {
        type: mark.type,
      };
      const attrs = sanitizeMarkAttrs(
        mark.type,
        mark.attrs as Record<string, unknown> | undefined,
      );
      if (attrs) result.attrs = attrs;
      return result;
    });

  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Recursively sanitizes Tiptap JSONContent to prevent XSS.
 *
 * - Strips unknown node types, marks, and attributes
 * - Validates URL schemes on `src` and `href` (allows http, https, mailto, relative)
 * - Preserves only allowlisted structure so Tiptap cannot render malicious DOM
 */
export function sanitizeContent(
  content: JSONContent | null | undefined,
  isRoot = true,
): JSONContent {
  // Guard against null/undefined body (e.g. posts created without body content)
  if (content == null) {
    return isRoot ? { type: "doc", content: [] } : { type: "paragraph" };
  }
  // Reject unknown node types — return an empty paragraph as a safe fallback
  if (content.type && !ALLOWED_NODE_TYPES.has(content.type)) {
    return { type: "paragraph" };
  }

  const result: JSONContent = {};

  // Preserve type
  if (content.type) {
    result.type = content.type;
  }

  // Preserve text (plain string, no HTML interpretation)
  if (typeof content.text === "string") {
    result.text = content.text;
  }

  // Sanitize attributes
  if (content.type && content.attrs) {
    const attrs = sanitizeAttrs(
      content.type,
      content.attrs as Record<string, unknown>,
    );
    if (attrs) result.attrs = attrs;
  }

  // Sanitize marks
  if (content.marks) {
    const marks = sanitizeMarks(
      content.marks as JSONContent["marks"],
    );
    if (marks) result.marks = marks;
  }

  // Recurse into children
  if (Array.isArray(content.content)) {
    result.content = content.content.map((child) =>
      sanitizeContent(child as JSONContent | null | undefined, false),
    );
  }

  return result;
}
