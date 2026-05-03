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

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const SWEEP_PAGE_SIZE = 200;

export const clearStaleStreamingLocks = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;

    const staleConversations = await ctx.db
      .query("conversations")
      .withIndex(
        "by_streamingInProgress_and_streamingStartedAt",
        (q) => q.eq("streamingInProgress", true).lt("streamingStartedAt", cutoff),
      )
      .collect();
    for (const conversation of staleConversations) {
      await ctx.db.patch(conversation._id, {
        streamingInProgress: false,
        streamingStartedAt: undefined,
      });
    }

    return null;
  },
});

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

crons.interval(
  "clear stale streaming locks",
  { minutes: 5 },
  internal.crons.clearStaleStreamingLocks,
  {},
);

crons.interval(
  "cleanup stale test otps",
  { minutes: 15 },
  internal.auth.testHelpers.cleanupStaleTestOtps,
  {},
);

crons.interval(
  "sweep orphaned storage",
  { hours: 24 },
  internal.crons.sweepOrphanedStorage,
  {},
);

export default crons;
