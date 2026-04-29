import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { contentStatusValidator } from "../content/schema";
import { resolveStorageUrl } from "../content/helpers";

const articleSummaryFields = {
  _id: v.id("articles"),
  _creationTime: v.number(),
  userId: v.id("users"),
  slug: v.string(),
  title: v.string(),
  coverImageUrl: v.union(v.string(), v.null()),
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
