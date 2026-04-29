import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { contentStatusValidator } from "../content/schema";
import { resolveStorageUrl } from "../content/helpers";
import { resolvePostCategory } from "./categories";

const postFields = {
  _id: v.id("posts"),
  _creationTime: v.number(),
  userId: v.id("users"),
  slug: v.string(),
  title: v.string(),
  body: v.any(),
  coverImageUrl: v.union(v.string(), v.null()),
  createdAt: v.number(),
  publishedAt: v.optional(v.number()),
  status: contentStatusValidator,
  category: v.string(),
};

export const postSummaryReturnValidator = v.object(postFields);

export const postWithBodyReturnValidator = v.object(postFields);

export async function resolvePostCoverImageUrl(
  ctx: QueryCtx | MutationCtx,
  coverImageStorageId: Id<"_storage"> | undefined,
): Promise<string | null> {
  return resolveStorageUrl(ctx, coverImageStorageId);
}

export function serializePost(
  post: Doc<"posts">,
  coverImageUrl: string | null,
) {
  return {
    _id: post._id,
    _creationTime: post._creationTime,
    userId: post.userId,
    slug: post.slug,
    title: post.title,
    body: post.body,
    coverImageUrl,
    createdAt: post.createdAt,
    publishedAt: post.publishedAt,
    status: post.status,
    category: resolvePostCategory(post),
  };
}
