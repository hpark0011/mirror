"use node";

// Shared helper for the markdown-import inline-image flow.
//
// Both `articles/actions.ts` and `posts/actions.ts` expose
// `internal.<entity>.actions.importMarkdownInlineImages`, which walks an
// entity's body for image nodes whose `attrs.src` is an absolute external
// URL with no `attrs.storageId`, fetches the bytes via `safeFetchImage`
// (SSRF-guarded), stores them via `ctx.storage.store(blob)`, then patches
// the body via the entity-specific `_patchInlineImageBody` mutation. The
// two per-entity actions used to contain near-identical handler bodies;
// this module is the shared core they both delegate to (FG_095).
//
// FG_096 changed the contract: this helper no longer hands the rewritten
// body to the patch closure. Instead it hands the closure a `srcMap`
// (`originalSrc → { src, storageId }`). The patch mutation re-reads the
// CURRENT body inside its transaction and applies the map as a merge —
// preserving any concurrent edits the user made during the multi-second
// fetch window. See `articles/internalImages.ts:_patchInlineImageBody`.
//
// Why a separate file (vs. extending `body-walk.ts`): `body-walk.ts` is a
// pure module (no Convex runtime imports). This helper calls
// `ctx.storage.store`, `ctx.storage.getUrl`, and `safeFetchImage` (which
// itself uses Node's `dns/promises` and runs under `"use node"`) — it is
// NOT pure. It belongs in a `"use node"` file. The camelCase filename
// matters: Convex 1.32.0's deploy server rejects all hyphenated module
// paths under `convex/`, regardless of whether they export functions.
//
// Callers wire the entity-specific patch closure (which runs the V8-runtime
// `_patchInlineImageBody` mutation for that entity) so this helper itself
// stays entity-agnostic.

import type { ActionCtx } from "../_generated/server";
import {
  collectExternalImageSrcs,
  type JSONContent,
} from "./body-walk";
import { safeFetchImage, SafeFetchError } from "./safe-fetch";
import { MAX_IMPORT_IMAGES_PER_ACTION } from "./storage-policy";
import type { Id } from "../_generated/dataModel";

export type ImageFailure = { src: string; reason: string };

export type ImportResult = {
  imported: number;
  failed: number;
  failures: ImageFailure[];
};

/**
 * `originalSrc → { src, storageId }`. Built by the helper from the
 * `resolved` Map and handed to the entity-specific patch closure, which
 * applies it as a merge against the current body.
 */
export type InlineImageSrcMap = Record<
  string,
  { src: string; storageId: Id<"_storage"> }
>;

/**
 * Fetch every external image URL in `body`, store the bytes via Convex
 * storage, and produce an `originalSrc → { src, storageId }` map. The map
 * is then handed to `patchBody`, which the caller wires to the
 * entity-specific `_patchInlineImageBody` mutation (closure captures the
 * entity id). The mutation re-reads the current body inside its
 * transaction and applies the map as a merge — preserving any concurrent
 * edits made during the fetch window (FG_096).
 *
 * Returns `{ imported, failed, failures[] }`. The `imported` count is the
 * number of distinct URLs successfully resolved (multiple image nodes
 * referencing the same URL share one storage blob).
 *
 * Idempotent: image nodes that already have `attrs.storageId` are
 * skipped at collection time and never end up in the srcMap. A re-run on
 * a previously-imported body is a no-op.
 *
 * Failures are collected per-URL — one bad URL does not abort the whole
 * import. The caller is responsible for any retry policy.
 */
export async function importMarkdownInlineImagesCore(
  ctx: ActionCtx,
  body: JSONContent | null,
  patchBody: (srcMap: InlineImageSrcMap) => Promise<void>,
): Promise<ImportResult> {
  if (!body) {
    return { imported: 0, failed: 0, failures: [] };
  }

  // First pass: identify each candidate image node and resolve it (if
  // possible) into `{ src → { storageId, newSrc } }`.
  const candidates = collectExternalImageSrcs(body);

  // Dedup unique URLs in body order, then cap to
  // MAX_IMPORT_IMAGES_PER_ACTION. Surplus unique URLs are surfaced as
  // failures with `reason: "import-cap-exceeded"` so the user knows what
  // happened and can re-invoke the import. (FG_101.) Keeping the cap on
  // unique URLs (not raw candidates) means a body with the same URL
  // referenced 100 times still gets imported in one action — only
  // distinct fetches count against the budget.
  const uniqueCandidates: string[] = [];
  const seen = new Set<string>();
  for (const src of candidates) {
    if (seen.has(src)) continue;
    seen.add(src);
    uniqueCandidates.push(src);
  }
  const limited = uniqueCandidates.slice(0, MAX_IMPORT_IMAGES_PER_ACTION);
  const overflow = uniqueCandidates.slice(MAX_IMPORT_IMAGES_PER_ACTION);

  const resolved = new Map<
    string,
    { storageId: Id<"_storage">; src: string }
  >();
  const failures: ImageFailure[] = [];
  for (const src of overflow) {
    failures.push({ src, reason: "import-cap-exceeded" });
  }
  // Track every URL we've attempted (success OR failure). Without this,
  // duplicate references to the same unreachable URL would each spend
  // FETCH_TIMEOUT_MS — N×10s easily exceeds the action budget. With the
  // dedup pass above this is now a defense-in-depth guard rather than
  // the primary dedup mechanism.
  const tried = new Set<string>();

  for (const src of limited) {
    if (resolved.has(src) || tried.has(src)) continue;
    tried.add(src);
    try {
      const blob = await safeFetchImage(src);
      const storageId = await ctx.storage.store(blob);
      const url = await ctx.storage.getUrl(storageId);
      if (!url) {
        failures.push({ src, reason: "storage-getUrl-null" });
        continue;
      }
      resolved.set(src, { storageId, src: url });
    } catch (err) {
      const reason =
        err instanceof SafeFetchError
          ? err.code
          : err instanceof Error
            ? err.message || "unknown"
            : "unknown";
      failures.push({ src, reason });
    }
  }

  // Build the srcMap (plain object — Convex `v.record` validator) from
  // the resolved entries. The patch mutation will re-read the body and
  // only apply entries whose original src still appears in the (possibly
  // edited) body.
  const srcMap: InlineImageSrcMap = {};
  for (const [originalSrc, hit] of resolved) {
    srcMap[originalSrc] = { src: hit.src, storageId: hit.storageId };
  }

  // Skip the round-trip when there's nothing to apply. Saves a mutation
  // call on the all-failures path.
  if (Object.keys(srcMap).length > 0) {
    await patchBody(srcMap);
  }

  return {
    imported: resolved.size,
    failed: failures.length,
    failures,
  };
}
