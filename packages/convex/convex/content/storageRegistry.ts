// Single source of truth for "where in the schema do we keep `_storage`
// references?". Both the orphan-sweep cron (`crons.sweepOrphanedStorage`)
// and the mutation-time cleanup helper
// (`inlineImageOwnership.filterUnreferencedStorageIds`) read this list.
//
// Adding a new `v.id("_storage")` field anywhere in the schema means
// appending an entry here. The schema-introspection regression test in
// `content/__tests__/orphanSweep.test.ts` will fail until both the
// schema source and this list agree (set equality on `<table>.<field>`).

import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { extractInlineImageStorageIds } from "./bodyWalk";

/**
 * `inline-body` covers the many-per-row case where storage IDs are embedded
 * inside a `body` JSONContent tree; the accessor returns the array of IDs
 * for that row.
 */
export type StorageFieldReference =
  | {
      kind: "scalar";
      table: "articles" | "posts" | "users";
      // Schema field name. The schema-introspection regression test in
      // `content/__tests__/orphanSweep.test.ts` builds `<table>.<field>`
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
    accessor: (doc) => (doc as Doc<"articles">).coverImageStorageId,
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

/**
 * Build the full "currently referenced" set by walking every entry in
 * `STORAGE_FIELD_REFERENCES`. Used by the orphan-sweep cron's first page,
 * which has no candidate set and must check every blob in `_storage`.
 *
 * O(rows × fields). Article+post body iteration is unbounded — see the
 * `crons.ts` header comment for the scale assumption.
 */
export async function buildReferencedStorageSet(
  ctx: MutationCtx,
): Promise<Set<string>> {
  const referenced = new Set<string>();
  // Each branch queries `ref.table` AFTER the discriminant narrows so the
  // accessor's input type lines up with the row union — moving the query
  // above the `if` widens `docs` to include `Doc<"users">` and the
  // inline-body accessor (which only handles articles/posts) stops type
  // checking.
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

/**
 * Candidate-aware variant: returns the subset of `candidates` that any row
 * in any registry-listed table currently references. Mutation-time cleanup
 * paths (`filterUnreferencedStorageIds`) use this so a future
 * `STORAGE_FIELD_REFERENCES` entry is automatically respected without each
 * caller re-writing the scan.
 */
export async function collectReferencedFromCandidates(
  ctx: MutationCtx,
  candidates: Iterable<string>,
): Promise<Set<string>> {
  const candidateSet = new Set<string>(candidates);
  const referenced = new Set<string>();
  if (candidateSet.size === 0) return referenced;

  for (const ref of STORAGE_FIELD_REFERENCES) {
    if (ref.kind === "scalar") {
      const docs = await ctx.db.query(ref.table).collect();
      for (const doc of docs) {
        const id = ref.accessor(doc);
        if (id && candidateSet.has(id)) referenced.add(id);
      }
    } else {
      const docs = await ctx.db.query(ref.table).collect();
      for (const doc of docs) {
        for (const id of ref.accessor(doc)) {
          if (candidateSet.has(id)) referenced.add(id);
        }
      }
    }
  }
  return referenced;
}
