import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { contentStatusValidator } from "../content/schema";
import { resolvePostCategory } from "./categories";

const postFields = {
  _id: v.id("posts"),
  _creationTime: v.number(),
  userId: v.id("users"),
  slug: v.string(),
  title: v.string(),
  body: v.any(),
  createdAt: v.number(),
  publishedAt: v.optional(v.number()),
  status: contentStatusValidator,
  category: v.string(),
};

export const postSummaryReturnValidator = v.object(postFields);

export const postWithBodyReturnValidator = v.object(postFields);

export function serializePost(post: Doc<"posts">) {
  return {
    _id: post._id,
    _creationTime: post._creationTime,
    userId: post.userId,
    slug: post.slug,
    title: post.title,
    body: post.body,
    createdAt: post.createdAt,
    publishedAt: post.publishedAt,
    status: post.status,
    category: resolvePostCategory(post),
  };
}
