// One-time slug backfill mutations for posts and articles.
//
// Why this exists: before the slug normalizer was wired up at the mutation
// boundary, malformed slugs (e.g., containing `?`) could be persisted via
// markdown frontmatter import. These rows are unreachable via URL because
// punctuation isn't valid in a path component. This file rewrites them in
// place using the canonical normalizer.
//
// Idempotent: running it twice is a no-op once slugs are clean.

import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { generateSlug, isValidSlug } from "./slug";

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

export const backfillPostSlugs = internalMutation({
  args: {},
  returns: summaryValidator,
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").collect();
    const rewrites: Array<{ id: string; from: string; to: string }> = [];

    for (const post of posts) {
      if (isValidSlug(post.slug)) continue;

      let normalized: string;
      try {
        normalized = generateSlug(post.title || post.slug);
      } catch {
        // Title and slug both produce empty after normalization — skip and
        // surface in the summary so a human can fix it manually.
        rewrites.push({ id: post._id, from: post.slug, to: "<UNFIXABLE>" });
        continue;
      }

      const free = await findFreeSlug(
        ctx,
        "posts",
        post.userId,
        normalized,
        post._id,
      );
      await ctx.db.patch(post._id, { slug: free });
      rewrites.push({ id: post._id, from: post.slug, to: free });
    }

    return {
      scanned: posts.length,
      fixed: rewrites.filter((r) => r.to !== "<UNFIXABLE>").length,
      rewrites,
    };
  },
});

export const backfillArticleSlugs = internalMutation({
  args: {},
  returns: summaryValidator,
  handler: async (ctx) => {
    const articles = await ctx.db.query("articles").collect();
    const rewrites: Array<{ id: string; from: string; to: string }> = [];

    for (const article of articles) {
      if (isValidSlug(article.slug)) continue;

      let normalized: string;
      try {
        normalized = generateSlug(article.title || article.slug);
      } catch {
        rewrites.push({
          id: article._id,
          from: article.slug,
          to: "<UNFIXABLE>",
        });
        continue;
      }

      const free = await findFreeSlug(
        ctx,
        "articles",
        article.userId,
        normalized,
        article._id,
      );
      await ctx.db.patch(article._id, { slug: free });
      rewrites.push({ id: article._id, from: article.slug, to: free });
    }

    return {
      scanned: articles.length,
      fixed: rewrites.filter((r) => r.to !== "<UNFIXABLE>").length,
      rewrites,
    };
  },
});
