// Cron registry for the Convex backend.
//
// Article+post body iteration in `sweepOrphanedStorage` is unbounded; the
// spec assumes <1000 records total (NFR-02). If scope grows beyond that,
// the sweep must be re-architected (paginated full-table walk + cursor
// resumption across the article/post tables).

import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ORPHAN_GRACE_MS } from "./content/storagePolicy";
import {
  STORAGE_FIELD_REFERENCES,
  type StorageFieldReference,
  buildReferencedStorageSet,
} from "./content/storageRegistry";

const SWEEP_PAGE_SIZE = 200;

// Re-exports for backward compatibility. The canonical home is
// `content/storageRegistry.ts`; both the orphan sweep here and
// `inlineImageOwnership.filterUnreferencedStorageIds` read from that single
// list so a new `v.id("_storage")` field can't drift between paths.
export { STORAGE_FIELD_REFERENCES, type StorageFieldReference };

/**
 * Test seam: the multi-page sweep test (FG_102) needs to assert that
 * `buildReferencedStorageSet` runs exactly once across all paginated pages,
 * not P times. ESM same-module identifier references are closed-over and
 * cannot be intercepted by `vi.spyOn` on a re-exported binding. Routing the
 * call through this object lets the test swap the implementation with a
 * `vi.fn()` wrapper that still delegates to the real helper but counts
 * invocations. Production code must always call
 * `_internals.buildReferencedStorageSet` (NOT the bare function) so the
 * indirection isn't accidentally bypassed.
 */
export const _internals = { buildReferencedStorageSet };

export const sweepOrphanedStorage = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    // Continuation pages receive the referenced-set computed on the FIRST
    // invocation. The set is invariant within a single sweep run (no schema
    // mutations land between scheduled pages), so recomputing it per page
    // would re-scan the articles/posts/users tables P times for nothing.
    // Absent on the cron-registered first call; present on every
    // scheduler.runAfter continuation.
    referencedIds: v.optional(v.array(v.string())),
  },
  returns: v.object({
    deleted: v.number(),
    scanned: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - ORPHAN_GRACE_MS;

    // No `.filter()` per .claude/rules/convex.md — use the system table
    // index `by_creation_time` with a range condition.
    const page = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .paginate({
        numItems: SWEEP_PAGE_SIZE,
        cursor: args.cursor ?? null,
      });

    // Compute the referenced-set only on the first page; subsequent pages
    // reuse the snapshot threaded through scheduler args. This is the SAME
    // set the first page used — even if articles/posts churn mid-sweep, the
    // first-page snapshot wins (consistency invariant).
    const referenced =
      args.referencedIds !== undefined
        ? new Set<string>(args.referencedIds)
        : await _internals.buildReferencedStorageSet(ctx);

    let deleted = 0;
    for (const entry of page.page) {
      if (referenced.has(entry._id)) continue;
      try {
        await ctx.storage.delete(entry._id);
        deleted += 1;
      } catch {
        // Ignore individual delete failures: a single bad blob must not
        // abort the whole batch (rolling back this page's deletes AND the
        // scheduler chain for subsequent pages). Unreferenced blobs that
        // fail today will resurface on the next sweep.
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.crons.sweepOrphanedStorage,
        {
          cursor: page.continueCursor,
          referencedIds: Array.from(referenced),
        },
      );
    }

    return {
      deleted,
      scanned: page.page.length,
      isDone: page.isDone,
    };
  },
});

const crons = cronJobs();

// Crons run on every Convex deployment they're registered on, regardless
// of whether anybody is connected. Per-worktree dev deployments
// (.claude/rules/worktrees.md) accumulate quickly, so dev-side cron
// registration burns Convex function-call quota for no benefit.
//
// Convex's own `CONVEX_CLOUD_URL` / `CONVEX_SITE_URL` vary by deployment
// slug, not by environment type, and so cannot reliably distinguish prod
// from dev. Set the gate explicitly on prod only:
//
//   pnpm --filter=@feel-good/convex exec convex env set IS_PROD true \
//     --prod
//
// Verify: `convex run --prod crons:listCronJobs` returns the orphan sweep;
// the same call against any dev deployment returns [].
if (process.env.IS_PROD === "true") {
  crons.interval(
    "sweep orphaned storage",
    { hours: 24 },
    internal.crons.sweepOrphanedStorage,
    {},
  );
}

export default crons;
