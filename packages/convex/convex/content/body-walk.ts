// Pure utilities for walking Tiptap JSONContent bodies to extract or
// rewrite inline image storage references.
//
// IMPORTANT: This is the single source of truth for inline-image traversal
// across articles, posts, the cron sweep, and the markdown-import action.
// Pure module: no Convex runtime imports — safe to import anywhere.
//
// The local JSONContent shape mirrors the one used in
// `embeddings/textExtractor.ts`, kept inline to avoid taking a dependency on
// `@tiptap/core` from server-side code.

/**
 * Minimal Tiptap JSONContent shape used by the body-walk helpers.
 * Mirrors the shape declared in `embeddings/textExtractor.ts`.
 */
export type JSONContent = {
  type?: string;
  text?: string;
  content?: JSONContent[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

/**
 * Recursively walks `body` and returns every `attrs.storageId` found on an
 * `image` node, in document order, with duplicates preserved (multiset
 * semantics). Image nodes lacking a `storageId` are skipped. Returns `[]`
 * for null, undefined, or empty bodies.
 */
export function extractInlineImageStorageIds(
  body: JSONContent | null | undefined,
): string[] {
  const ids: string[] = [];
  if (!body) {
    return ids;
  }
  collectInlineImageStorageIds(body, ids);
  return ids;
}

function collectInlineImageStorageIds(
  node: JSONContent,
  out: string[],
): void {
  if (node.type === "image") {
    const id = node.attrs?.storageId;
    if (typeof id === "string" && id.length > 0) {
      out.push(id);
    }
  }

  const children = node.content;
  if (!children || children.length === 0) {
    return;
  }
  for (const child of children) {
    collectInlineImageStorageIds(child, out);
  }
}

/**
 * Recursively rewrites every `image` node's `attrs` via `mapFn(attrs) →
 * attrs`, preserving the surrounding tree shape. Non-image leaves pass
 * through unchanged in content, but parent nodes along the walk path are
 * reallocated even when no descendant changed (we don't pairwise-compare
 * children — overhead not worth it for our document sizes). Input is
 * never mutated; a new tree is always returned.
 */
export function mapInlineImages(
  body: JSONContent | null | undefined,
  mapFn: (
    attrs: Record<string, unknown> | undefined,
  ) => Record<string, unknown> | undefined,
): JSONContent | null | undefined {
  if (!body) {
    return body;
  }
  return mapNode(body, mapFn);
}

function mapNode(
  node: JSONContent,
  mapFn: (
    attrs: Record<string, unknown> | undefined,
  ) => Record<string, unknown> | undefined,
): JSONContent {
  const mappedChildren = node.content
    ? node.content.map((child) => mapNode(child, mapFn))
    : node.content;

  if (node.type === "image") {
    const newAttrs = mapFn(node.attrs);
    return {
      ...node,
      attrs: newAttrs,
      ...(mappedChildren !== undefined ? { content: mappedChildren } : {}),
    };
  }

  if (mappedChildren !== node.content) {
    return { ...node, content: mappedChildren };
  }
  return node;
}
