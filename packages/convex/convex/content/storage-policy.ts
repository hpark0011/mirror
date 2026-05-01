// Shared storage-policy constants for inline image and orphan-sweep flows.
//
// IMPORTANT: This is the single source of truth for size, MIME, redirect, and
// orphan grace policies across the repo. Both the Convex backend and the
// Next.js client import from this module via `@feel-good/convex/convex/content/storage-policy`.
//
// Pure module: no Convex runtime imports, so it is safe to import from both
// the Convex backend and the Next.js client.
//
// Pure module: no Convex function registrations (query/mutation/action/internal*)
// allowed in this file because the filename contains a hyphen — Convex's dotted
// internal.* router cannot resolve hyphenated paths. Add functions to
// camelCase sibling files instead.

/**
 * Grace period after which an unreferenced `_storage` blob is eligible for
 * cron sweeping. Strictly greater than Convex's 1-hour upload URL TTL plus
 * any reasonable client retry window.
 */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Maximum byte size of an inline image upload. Same value used for cover
 * image uploads — these are deliberately the same policy.
 */
export const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Allowed MIME types for inline image uploads (paste, drop, file picker) and
 * markdown imports. Same set used for cover image uploads.
 */
export const ALLOWED_INLINE_IMAGE_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * Maximum number of redirect hops `safeFetchImage` will follow when
 * importing markdown image references. Each hop is re-resolved via DNS and
 * its IP re-checked against the SSRF blocklist before initiating the next
 * request.
 */
export const MAX_FETCH_REDIRECTS = 3;
