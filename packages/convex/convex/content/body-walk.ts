// Pure utilities for walking Tiptap JSONContent bodies to extract or
// rewrite inline image storage references.
//
// IMPORTANT: This is the single source of truth for inline-image traversal
// across articles, posts, the cron sweep, and the markdown-import action.
// Exports cover BOTH directions: storage-id collection (used by the cron
// sweep + delete-cascade) and external-URL collection (used by the
// markdown-import action). Pure module: no Convex runtime imports — safe to
// import anywhere.
//
// Pure module: no Convex function registrations (query/mutation/action/internal*)
// allowed in this file because the filename contains a hyphen — Convex's dotted
// internal.* router cannot resolve hyphenated paths. Add functions to
// camelCase sibling files instead.
//
// The local JSONContent shape mirrors the one used in
// `embeddings/textExtractor.ts`, kept inline to avoid taking a dependency on
// `@tiptap/core` from server-side code.
//
// `Id<"_storage">` is imported as a TYPE only — the dataModel module ships
// types only at compile-time and so this import does not pull in any Convex
// runtime code.

import type { Id } from "../_generated/dataModel";

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
 *
 * Returns `Id<"_storage">[]` to constrain callers — every value pushed here
 * is sourced from `attrs.storageId` on an image node, which by convention
 * (and validated by the sanitizer regex) holds a Convex storage ID. The
 * cast is at the source so downstream call sites can pass the result
 * directly to `ctx.storage.delete(...)` / `ctx.storage.getUrl(...)` without
 * re-narrowing.
 */
export function extractInlineImageStorageIds(
  body: JSONContent | null | undefined,
): Id<"_storage">[] {
  const ids: Id<"_storage">[] = [];
  if (!body) {
    return ids;
  }
  collectInlineImageStorageIds(body, ids);
  return ids;
}

function collectInlineImageStorageIds(
  node: JSONContent,
  out: Id<"_storage">[],
): void {
  if (node.type === "image") {
    const id = node.attrs?.storageId;
    if (typeof id === "string" && id.length > 0) {
      // Cast at the source — see the function-level comment.
      out.push(id as Id<"_storage">);
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

/**
 * Returns the multiset difference `a - b`: for each occurrence in `b`, removes
 * one matching occurrence from `a`. Useful for diffing inline image storage
 * IDs across an `update` mutation: `multisetDifference(oldIds, newIds)` yields
 * exactly the IDs that were removed (counting duplicates).
 *
 * Generic over `T extends string` so callers can pass `Id<"_storage">[]`
 * without losing the brand. (`Id<TableName>` is a string subtype at runtime.)
 *
 * NOTE: this returns "what's removed by count" — it does NOT account for the
 * still-referenced case. `[a, a, a] - [a] → [a, a]`. The caller is
 * responsible for filtering against the new set if it cares about
 * "blob's reference count fell to zero" (see articles/mutations.ts and
 * posts/mutations.ts for the load-bearing filter).
 */
export function multisetDifference<T extends string>(a: T[], b: T[]): T[] {
  const counts = new Map<T, number>();
  for (const v of b) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const out: T[] = [];
  for (const v of a) {
    const c = counts.get(v) ?? 0;
    if (c > 0) {
      counts.set(v, c - 1);
    } else {
      out.push(v);
    }
  }
  return out;
}

/**
 * Returns `true` iff `value` looks like an absolute http(s) URL. Used by the
 * markdown-import action to filter image nodes whose `attrs.src` is an
 * external URL (vs. a relative path or a `data:` URI).
 */
export function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Walks `body` and returns every external (`http(s)://`) `attrs.src` found on
 * an `image` node that does NOT already carry an `attrs.storageId`. Document
 * order, duplicates preserved (caller dedupes via a `Set` if needed). Returns
 * `[]` for null/undefined/empty bodies.
 *
 * Used by the markdown-import action to identify candidate inline images for
 * fetch + storage rewrite. Image nodes that already have a storageId are
 * skipped (the import is idempotent — a re-run is a no-op for them).
 */
export function collectExternalImageSrcs(
  node: JSONContent | null | undefined,
): string[] {
  if (!node) return [];
  const out: string[] = [];
  collectExternalImageSrcsRec(node, out);
  return out;
}

function collectExternalImageSrcsRec(
  node: JSONContent,
  out: string[],
): void {
  if (node.type === "image") {
    const attrs = node.attrs;
    const storageId = attrs?.storageId;
    if (typeof storageId === "string" && storageId.length > 0) {
      // Already imported; skip (idempotent).
    } else {
      const src = attrs?.src;
      if (typeof src === "string" && isAbsoluteHttpUrl(src)) {
        out.push(src);
      }
    }
  }
  const children = node.content;
  if (!children) return;
  for (const child of children) {
    collectExternalImageSrcsRec(child, out);
  }
}
