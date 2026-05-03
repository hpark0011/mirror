"use node";

// Shared helper for the markdown-import inline-image flow.
//
// Both `articles/actions.ts` and `posts/actions.ts` expose
// `internal.<entity>.actions.importMarkdownInlineImages`, which walks an
// entity's body for image nodes whose `attrs.src` is an absolute external
// URL with no `attrs.storageId`, fetches the bytes via `safeFetchImage`
// (SSRF-guarded), stores them via `ctx.storage.store(blob)`, then patches
// the body with a Convex-served URL and the new `storageId`. The two
// per-entity actions used to contain near-identical handler bodies; this
// module is the shared core they both delegate to (FG_095).
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
  isAbsoluteHttpUrl,
  mapInlineImages,
  type JSONContent,
} from "./body-walk";
import { safeFetchImage, SafeFetchError } from "./safe-fetch";
import type { Id } from "../_generated/dataModel";

export type ImageFailure = { src: string; reason: string };

export type ImportResult = {
  imported: number;
  failed: number;
  failures: ImageFailure[];
};

/**
 * Fetch every external image URL in `body`, store the bytes via Convex
 * storage, and produce a rewritten body with `attrs.src` pointing at the
 * Convex-served URL and `attrs.storageId` set. The rewritten body is then
 * persisted via `patchBody`, which the caller wires to the entity-specific
 * `_patchInlineImageBody` mutation (closure captures the entity id).
 *
 * Returns `{ imported, failed, failures[] }`. The `imported` count is the
 * number of distinct URLs successfully resolved (multiple image nodes
 * referencing the same URL share one storage blob).
 *
 * Idempotent: image nodes that already have `attrs.storageId` are left
 * untouched. A re-run on a previously-imported body is a no-op.
 *
 * Failures are collected per-URL — one bad URL does not abort the whole
 * import. The caller is responsible for any retry policy.
 */
export async function importMarkdownInlineImagesCore(
  ctx: ActionCtx,
  body: JSONContent | null,
  patchBody: (next: JSONContent) => Promise<void>,
): Promise<ImportResult> {
  if (!body) {
    return { imported: 0, failed: 0, failures: [] };
  }

  // First pass: identify each candidate image node and resolve it (if
  // possible) into `{ src → { storageId, newSrc } }`. We do this BEFORE the
  // tree rewrite so the synchronous mapper has all answers in hand.
  const candidates = collectExternalImageSrcs(body);
  const resolved = new Map<
    string,
    { storageId: Id<"_storage">; src: string }
  >();
  const failures: ImageFailure[] = [];
  // Track every URL we've attempted (success OR failure). Without this,
  // duplicate references to the same unreachable URL would each spend
  // FETCH_TIMEOUT_MS — N×10s easily exceeds the action budget.
  const tried = new Set<string>();

  for (const src of candidates) {
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

  // Second pass: rewrite the body using the resolved map. Image nodes that
  // failed (or already had a storageId) are left untouched.
  const rewritten = mapInlineImages(body, (attrs) => {
    if (!attrs) return attrs;
    const existing = attrs.storageId;
    if (typeof existing === "string" && existing.length > 0) {
      return attrs; // already imported — idempotent
    }
    const src = attrs.src;
    if (typeof src !== "string" || !isAbsoluteHttpUrl(src)) {
      return attrs;
    }
    const hit = resolved.get(src);
    if (!hit) return attrs;
    return { ...attrs, src: hit.src, storageId: hit.storageId };
  }) as JSONContent;

  await patchBody(rewritten);

  return {
    imported: resolved.size,
    failed: failures.length,
    failures,
  };
}
