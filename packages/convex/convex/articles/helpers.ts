import { v } from "convex/values";
import { type QueryCtx, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { contentStatusValidator } from "../content/schema";
import { resolveStorageUrl, validateContentStringLength } from "../content/helpers";

// A real thumbhash encodes 5–25 bytes -> ~7–36 base64 chars in practice.
// Cap at 256 to absorb any future format variation while still bounding
// what an attacker can stuff into the field.
export const MAX_THUMBHASH_LENGTH = 256;

// Standard base64 alphabet (no URL-safe variant, no whitespace). The
// backfill encodes via `Buffer.from(...).toString("base64")` which produces
// exactly this character set, so client-supplied hashes that diverge are
// rejected at the boundary.
const THUMBHASH_BASE64_PATTERN = /^[A-Za-z0-9+/]+=*$/;

export function validateThumbhashFormat(value: string): void {
  validateContentStringLength(value, "coverImageThumbhash", MAX_THUMBHASH_LENGTH);
  if (!THUMBHASH_BASE64_PATTERN.test(value)) {
    throw new Error(
      `Invalid coverImageThumbhash: must be base64-encoded and at most ${MAX_THUMBHASH_LENGTH} characters`,
    );
  }
}

const articleSummaryFields = {
  _id: v.id("articles"),
  _creationTime: v.number(),
  userId: v.id("users"),
  slug: v.string(),
  title: v.string(),
  coverImageUrl: v.union(v.string(), v.null()),
  coverImageThumbhash: v.union(v.string(), v.null()),
  // PLAN_010: video cover sibling URLs. Both null when the article has
  // no video cover. The list card and detail view branch on
  // `coverVideoUrl` first (video wins), falling back to
  // `coverImageUrl`.
  coverVideoUrl: v.union(v.string(), v.null()),
  coverVideoPosterUrl: v.union(v.string(), v.null()),
  createdAt: v.number(),
  publishedAt: v.optional(v.number()),
  status: contentStatusValidator,
  category: v.string(),
};

export const articleSummaryReturnValidator = v.object(articleSummaryFields);

export const articleWithBodyReturnValidator = v.object({
  ...articleSummaryFields,
  body: v.any(),
});

export const conversationArticleReturnValidator = v.object({
  title: v.string(),
  body: v.any(),
});

export async function resolveArticleCoverImageUrl(
  ctx: QueryCtx | MutationCtx,
  coverImageStorageId: Id<"_storage"> | undefined,
): Promise<string | null> {
  return resolveStorageUrl(ctx, coverImageStorageId);
}
