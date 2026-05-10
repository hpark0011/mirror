import { v } from "convex/values";
import { type Doc } from "../_generated/dataModel";
import { type MutationCtx, type QueryCtx } from "../_generated/server";
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
  coverImageThumbhash: v.optional(v.string()),
  coverVideoUrl: v.union(v.string(), v.null()),
  coverVideoPosterUrl: v.union(v.string(), v.null()),
  createdAt: v.number(),
  publishedAt: v.optional(v.number()),
  status: contentStatusValidator,
  category: v.string(),
};

export const postSummaryReturnValidator = v.object(postFields);

export const postWithBodyReturnValidator = v.object(postFields);

export type PostCoverUrls = {
  coverImageUrl: string | null;
  coverVideoUrl: string | null;
  coverVideoPosterUrl: string | null;
};

export async function resolvePostCoverUrls(
  ctx: QueryCtx | MutationCtx,
  post: Pick<
    Doc<"posts">,
    "coverImageStorageId" | "coverVideoStorageId" | "coverVideoPosterStorageId"
  >,
): Promise<PostCoverUrls> {
  const [coverImageUrl, coverVideoUrl, coverVideoPosterUrl] = await Promise.all(
    [
      resolveStorageUrl(ctx, post.coverImageStorageId),
      resolveStorageUrl(ctx, post.coverVideoStorageId),
      resolveStorageUrl(ctx, post.coverVideoPosterStorageId),
    ],
  );
  return { coverImageUrl, coverVideoUrl, coverVideoPosterUrl };
}

export function serializePost(
  post: Doc<"posts">,
  covers: PostCoverUrls,
) {
  return {
    _id: post._id,
    _creationTime: post._creationTime,
    userId: post.userId,
    slug: post.slug,
    title: post.title,
    body: post.body,
    coverImageUrl: covers.coverImageUrl,
    coverImageThumbhash: post.coverImageThumbhash,
    coverVideoUrl: covers.coverVideoUrl,
    coverVideoPosterUrl: covers.coverVideoPosterUrl,
    createdAt: post.createdAt,
    publishedAt: post.publishedAt,
    status: post.status,
    category: resolvePostCategory(post),
  };
}
