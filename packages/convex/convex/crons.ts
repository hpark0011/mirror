// Cron registry for the Convex backend.
//
// Article+post body iteration in `sweepOrphanedStorage` is unbounded; the
// spec assumes <1000 records total (NFR-02). If scope grows beyond that,
// the sweep must be re-architected (paginated full-table walk + cursor
// resumption across the article/post tables).

import { cronJobs } from "convex/server";
import { v } from "convex/values";
import {
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ORPHAN_GRACE_MS } from "./content/storage-policy";
import { extractInlineImageStorageIds } from "./content/body-walk";

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

/**
 * Snapshot of every `(table, accessor)` pair whose value is an
 * `Id<"_storage">`. The orphan sweep iterates this list to build the
 * "currently referenced" set. The snapshot is duplicated by the
 * schema-introspection regression test in
 * `content/__tests__/orphan-sweep.test.ts` — adding a new
 * `v.id("_storage")` field anywhere in the schema without updating BOTH
 * lists will fail that test.
 *
 * `inline-body` covers the many-per-row case where storage IDs are embedded
 * inside a `body` JSONContent tree; the accessor returns the array of IDs
 * for that row.
 */
export type StorageFieldReference =
  | {
      kind: "scalar";
      table: "articles" | "posts" | "users";
      // Schema field name. The schema-introspection regression test in
      // `content/__tests__/orphan-sweep.test.ts` builds `<table>.<field>`
      // keys from BOTH the schema source and this list and asserts set
      // equality. Don't free-form rename — `field` is the canonical key.
      field: string;
      accessor: (
        doc: Doc<"articles"> | Doc<"posts"> | Doc<"users">,
      ) => Id<"_storage"> | undefined;
      description: string;
    }
  | {
      kind: "inline-body";
      table: "articles" | "posts";
      // Returns `Id<"_storage">[]` (NOT `string[]`) so the type system fails
      // closed if a future accessor mistakenly returns slugs/titles/etc.
      // The runtime values are storage IDs already — see
      // `extractInlineImageStorageIds`.
      accessor: (
        doc: Doc<"articles"> | Doc<"posts">,
      ) => Id<"_storage">[];
      description: string;
    };

export const STORAGE_FIELD_REFERENCES: ReadonlyArray<StorageFieldReference> = [
  {
    kind: "scalar",
    table: "articles",
    field: "coverImageStorageId",
    accessor: (doc) =>
      (doc as Doc<"articles">).coverImageStorageId,
    description: "articles.coverImageStorageId",
  },
  {
    kind: "scalar",
    table: "posts",
    field: "coverImageStorageId",
    accessor: (doc) => (doc as Doc<"posts">).coverImageStorageId,
    description: "posts.coverImageStorageId",
  },
  {
    kind: "scalar",
    table: "users",
    field: "avatarStorageId",
    accessor: (doc) => (doc as Doc<"users">).avatarStorageId,
    description: "users.avatarStorageId",
  },
  {
    kind: "inline-body",
    table: "articles",
    accessor: (doc) =>
      extractInlineImageStorageIds((doc as Doc<"articles">).body),
    description: "articles.body inline image storageIds",
  },
  {
    kind: "inline-body",
    table: "posts",
    accessor: (doc) =>
      extractInlineImageStorageIds((doc as Doc<"posts">).body),
    description: "posts.body inline image storageIds",
  },
];

async function buildReferencedStorageSet(
  ctx: MutationCtx,
): Promise<Set<string>> {
  const referenced = new Set<string>();
  // Walk each STORAGE_FIELD_REFERENCES entry and collect every referenced
  // storage ID. Article+post body iteration is unbounded — see header
  // comment.
  for (const ref of STORAGE_FIELD_REFERENCES) {
    if (ref.kind === "scalar") {
      const docs = await ctx.db.query(ref.table).collect();
      for (const doc of docs) {
        const id = ref.accessor(doc);
        if (id) referenced.add(id);
      }
    } else {
      const docs = await ctx.db.query(ref.table).collect();
      for (const doc of docs) {
        for (const id of ref.accessor(doc)) {
          referenced.add(id);
        }
      }
    }
  }
  return referenced;
}

export const sweepOrphanedStorage = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
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

    const referenced = await buildReferencedStorageSet(ctx);

    let deleted = 0;
    for (const entry of page.page) {
      if (referenced.has(entry._id)) continue;
      await ctx.storage.delete(entry._id);
      deleted += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.crons.sweepOrphanedStorage,
        { cursor: page.continueCursor },
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
