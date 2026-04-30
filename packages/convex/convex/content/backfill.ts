// One-time slug backfill mutations for posts and articles.
//
// Why this exists: before the slug normalizer was wired up at the mutation
// boundary, malformed slugs (e.g., containing `?`) could be persisted via
// markdown frontmatter import. These rows are unreachable via URL because
// punctuation isn't valid in a path component. This file rewrites them in
// place using the canonical normalizer.
//
// Idempotent: running it twice is a no-op once slugs are clean.
//
// Invocation:
//   cd packages/convex && npx convex run content/backfill:backfillPostSlugs '{}'
//   cd packages/convex && npx convex run content/backfill:backfillArticleSlugs '{}'
// Prod (after reviewing dev output):
//   cd packages/convex && CONVEX_DEPLOYMENT=<prod-slug> npx convex run --prod content/backfill:backfillPostSlugs '{}'
//
// Operator runbook — READ BEFORE RUNNING:
//   The original `from` slugs only live in this mutation's return value.
//   Once the patch lands, the old slug is gone from the DB. Capturing stdout
//   to a log file is therefore MANDATORY — it is your only paper trail if a
//   rewrite needs to be reversed or audited later.
//
//   Steps (per table):
//     1. Pre-run sanity check — count rows that will be touched. From the
//        Convex dashboard's data view, eyeball the `posts`/`articles` table
//        for any slugs that don't match /^[a-z0-9]+(?:-[a-z0-9]+)*$/.
//     2. Capture stdout, e.g.:
//          npx convex run content/backfill:backfillPostSlugs '{}' \
//            > backfill-posts-$(date +%s).log 2>&1
//     3. Run the mutation (the command above).
//     4. Re-run the mutation. The second run must return `fixed === 0`.
//        If it doesn't, something is racing or the normalizer is non-idempotent
//        — stop and investigate before continuing.
//     5. Inspect any rewrite entries with `to: "<UNFIXABLE>"` manually. These
//        are rows where both `slug` and `title` normalize to empty; they need
//        a human-supplied slug via the regular update mutation.

import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { MAX_SLUG_LENGTH } from "../content/schema";
import { validateContentStringLength } from "./helpers";
import { assertValidSlug, generateSlug, isValidSlug } from "./slug";

const summaryValidator = v.object({
  scanned: v.number(),
  fixed: v.number(),
  rewrites: v.array(
    v.object({
      id: v.string(),
      from: v.string(),
      to: v.string(),
    }),
  ),
});

type BackfillSummary = {
  scanned: number;
  fixed: number;
  rewrites: Array<{ id: string; from: string; to: string }>;
};

// Auto-suffix (-2, -3) is intentional ONLY for one-shot cleanup of unreachable rows. The user-facing create/update mutations throw on collision instead. Do not reuse this helper for live mutation paths.
async function findFreeSlug(
  ctx: MutationCtx,
  table: "posts" | "articles",
  userId: Id<"users">,
  desired: string,
  selfId: string,
): Promise<string> {
  // Collision-aware suffixing: if `desired` is already taken by a *different*
  // row owned by the same user, append `-2`, `-3`, etc.
  let candidate = desired;
  let suffix = 2;
  // Cap iterations to avoid runaway loops on pathological data.
  for (let i = 0; i < 100; i++) {
    const existing = await ctx.db
      .query(table)
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", userId).eq("slug", candidate),
      )
      .unique();
    if (!existing || existing._id === selfId) {
      return candidate;
    }
    candidate = `${desired}-${suffix}`;
    suffix += 1;
  }
  throw new Error(`Could not find a free slug for "${desired}" after 100 tries`);
}

async function backfillSlugs(
  ctx: MutationCtx,
  table: "posts" | "articles",
): Promise<BackfillSummary> {
  // ctx.db.query accepts a runtime string and types correctly via the
  // DataModel union — both `posts` and `articles` carry the same
  // `userId` / `slug` / `title` fields via `contentBaseFields`.
  const rows = await ctx.db.query(table).collect();
  const rewrites: Array<{ id: string; from: string; to: string }> = [];

  for (const row of rows) {
    if (isValidSlug(row.slug)) continue;

    let normalized: string;
    try {
      normalized = generateSlug(row.title || row.slug);
    } catch {
      // Title and slug both produce empty after normalization — skip and
      // surface in the summary so a human can fix it manually.
      rewrites.push({ id: row._id, from: row.slug, to: "<UNFIXABLE>" });
      continue;
    }

    const free = await findFreeSlug(ctx, table, row.userId, normalized, row._id);

    // Boundary checks before patch: a 200-char title can produce a slug that
    // exceeds MAX_SLUG_LENGTH after `-2` suffixing, and a future change to
    // generateSlug could (in theory) produce a non-canonical output. If
    // either fires, surface the row as <UNFIXABLE> instead of writing a
    // malformed slug to the DB.
    try {
      validateContentStringLength(free, "Slug", MAX_SLUG_LENGTH);
      assertValidSlug(free);
    } catch {
      rewrites.push({ id: row._id, from: row.slug, to: "<UNFIXABLE>" });
      continue;
    }

    await ctx.db.patch(row._id, { slug: free });
    rewrites.push({ id: row._id, from: row.slug, to: free });
  }

  // scanned = total rows in the table (not "rows that needed inspection"). Re-running after a clean state returns scanned > 0 and fixed === 0.
  return {
    scanned: rows.length,
    fixed: rewrites.filter((r) => r.to !== "<UNFIXABLE>").length,
    rewrites,
  };
}

export const backfillPostSlugs = internalMutation({
  args: {},
  returns: summaryValidator,
  handler: async (ctx) => {
    return await backfillSlugs(ctx, "posts");
  },
});

export const backfillArticleSlugs = internalMutation({
  args: {},
  returns: summaryValidator,
  handler: async (ctx) => {
    return await backfillSlugs(ctx, "articles");
  },
});
