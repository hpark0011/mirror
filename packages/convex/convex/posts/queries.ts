import { query } from "../_generated/server";
import { v } from "convex/values";
import {
  filterVisibleContent,
  getUserAndContentAccess,
} from "../content/helpers";
import {
  postSummaryReturnValidator,
  postWithBodyReturnValidator,
  serializePost,
} from "./helpers";

export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(v.array(postSummaryReturnValidator), v.null()),
  handler: async (ctx, args) => {
    const access = await getUserAndContentAccess(ctx, args.username);
    if (!access) {
      return null;
    }

    const { user, isOwner } = access;
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return filterVisibleContent(posts, isOwner).map(serializePost);
  },
});

export const getBySlug = query({
  args: { username: v.string(), slug: v.string() },
  returns: v.union(postWithBodyReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const access = await getUserAndContentAccess(ctx, args.username);
    if (!access) {
      return null;
    }

    const { user, isOwner } = access;
    const post = await ctx.db
      .query("posts")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", user._id).eq("slug", args.slug),
      )
      .unique();
    if (!post) {
      return null;
    }

    if (post.status === "draft" && !isOwner) {
      return null;
    }

    return serializePost(post);
  },
});
