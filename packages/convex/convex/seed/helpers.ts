import { type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { components } from "../_generated/api";
import { createThread, saveMessage } from "@convex-dev/agent";
import { getPostCategoryForSlug } from "../posts/categories";
import { SEED_ARTICLES, SEED_POSTS, SEED_CONVERSATIONS } from "./data";

export async function ensureRickRubinUser(
  ctx: MutationCtx,
): Promise<Id<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_username", (q: any) => q.eq("username", "rick-rubin"))
    .unique();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("users", {
    authId: "seed_rick_rubin",
    email: "rick@example.com",
    username: "rick-rubin",
    name: "Rick Rubin",
    tagline: "Rick Rubin has been a singular, transformative creative muse for artists across genres and generations — from the Beastie Boys to Johnny Cash, from Public Enemy to the Red Hot Chili Peppers, from Adele to Jay-Z.",
    onboardingComplete: true,
  });
}

export async function ensureRickRubinArticles(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const existing = await ctx.db
    .query("articles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  if (existing) {
    return;
  }

  const now = Date.now();
  for (const article of SEED_ARTICLES) {
    const createdAt = now - article.daysAgo * 24 * 60 * 60 * 1000;
    await ctx.db.insert("articles", {
      userId,
      slug: article.slug,
      title: article.title,
      category: article.category,
      body: article.body,
      status: "published",
      createdAt,
      publishedAt: createdAt,
    });
  }
}

export async function ensureRickRubinPosts(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const existingPosts = await ctx.db
    .query("posts")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();
  const existingSlugs = new Set(existingPosts.map((post) => post.slug));

  const now = Date.now();
  for (const post of SEED_POSTS) {
    if (existingSlugs.has(post.slug)) {
      continue;
    }

    const createdAt = now - post.daysAgo * 24 * 60 * 60 * 1000;
    await ctx.db.insert("posts", {
      userId,
      slug: post.slug,
      title: post.title,
      category: getPostCategoryForSlug(post.slug),
      body: post.body,
      status: "published",
      createdAt,
      publishedAt: createdAt,
    });
  }
}

export async function ensureRickRubinConversations(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_profileOwnerId_and_viewerId", (q: any) =>
      q.eq("profileOwnerId", userId),
    )
    .first();
  if (existing) {
    return;
  }

  for (const convo of SEED_CONVERSATIONS) {
    const threadId = await createThread(ctx, components.agent, {});

    await ctx.db.insert("conversations", {
      profileOwnerId: userId,
      threadId,
      status: "active",
      title: convo.title,
    });

    for (const msg of convo.messages) {
      if (msg.role === "user") {
        await saveMessage(ctx, components.agent, {
          threadId,
          prompt: msg.text,
        });
      } else {
        await saveMessage(ctx, components.agent, {
          threadId,
          message: {
            role: "assistant",
            content: [{ type: "text", text: msg.text }],
          },
        });
      }
    }
  }
}
