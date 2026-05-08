import { type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { components } from "../_generated/api";
import { createThread, saveMessage } from "@convex-dev/agent";
import { getPostCategoryForSlug } from "../posts/categories";
import { RESERVED_USERNAMES } from "../users/helpers";
import {
  SEED_ARTICLES,
  SEED_BIO,
  SEED_CONVERSATIONS,
  SEED_OWNER_PROFILE,
  SEED_POSTS,
} from "./data";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// Email local-part → valid username per `users/mutations.ts:setUsername`
// (3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen).
// Seeds that hand-pick the local-part (e.g. `hpark0011`) succeed; otherwise
// throw with the same intent the onboarding wizard surfaces — the caller
// must pick a different name. Idempotent.
function deriveUsernameFromEmail(email: string): string {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  const cleaned = localPart
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  if (!USERNAME_PATTERN.test(cleaned)) {
    throw new Error(
      `Cannot derive a valid username from email "${email}". Pass a username explicitly to seedWorktreeOwnerDemo.`,
    );
  }
  if (RESERVED_USERNAMES.has(cleaned)) {
    throw new Error(
      `Derived username "${cleaned}" is reserved. Pass a username explicitly to seedWorktreeOwnerDemo.`,
    );
  }
  return cleaned;
}

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
  // Per-slug dedup (mirrors ensureRickRubinPosts). A single-row "any
  // article exists" check would silently skip seeding for a real
  // worktree owner who already has one of their own articles —
  // seedWorktreeOwnerDemo would yield zero fixtures with no error.
  const existingArticles = await ctx.db
    .query("articles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();
  const existingSlugs = new Set(existingArticles.map((article) => article.slug));

  const now = Date.now();
  for (const article of SEED_ARTICLES) {
    if (existingSlugs.has(article.slug)) {
      continue;
    }

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
  // Per-title dedup. threadId is generated per-call so it can't anchor
  // idempotency; title is the stable key in SEED_CONVERSATIONS. A
  // single-row "any conversation exists" check would silently skip
  // seeding for a worktree owner who already has one of their own
  // conversations — seedWorktreeOwnerDemo would yield zero fixtures
  // with no error.
  const existingConversations = await ctx.db
    .query("conversations")
    .withIndex("by_profileOwnerId_and_viewerId", (q: any) =>
      q.eq("profileOwnerId", userId),
    )
    .collect();
  const existingTitles = new Set(
    existingConversations.map((convo) => convo.title),
  );

  for (const convo of SEED_CONVERSATIONS) {
    if (existingTitles.has(convo.title)) {
      continue;
    }

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

// Patches the worktree owner's existing `users` row with onboarding-equivalent
// fields (username/name/tagline/onboardingComplete) so /onboarding redirects
// to the profile page. Per-field idempotency: each field is only set when the
// current value is empty/false. Re-running never overwrites a value the user
// has changed via the real onboarding flow.
export async function ensureWorktreeOwnerProfile(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string,
  preferredName?: string,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error(`ensureWorktreeOwnerProfile: user ${userId} not found`);
  }

  const patch: {
    username?: string;
    name?: string;
    tagline?: string;
    onboardingComplete?: boolean;
  } = {};

  if (!user.username) {
    const derived = deriveUsernameFromEmail(email);
    const existingByUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", derived))
      .unique();
    if (existingByUsername !== null && existingByUsername._id !== userId) {
      throw new Error(
        `ensureWorktreeOwnerProfile: username "${derived}" is already taken by another user`,
      );
    }
    patch.username = derived;
  }

  if (!user.name && preferredName !== undefined && preferredName.trim() !== "") {
    patch.name = preferredName.trim();
  }

  if (!user.tagline) {
    patch.tagline = SEED_OWNER_PROFILE.tagline;
  }

  if (!user.onboardingComplete) {
    patch.onboardingComplete = true;
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(userId, patch);
  }
}

export async function ensureWorktreeOwnerBio(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  // Per (kind+title) dedup. The bioEntries schema has no natural unique key,
  // and a "any row exists" short-circuit would skip seeding for an owner who
  // already added one of their own entries.
  const existingEntries = await ctx.db
    .query("bioEntries")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const existingKeys = new Set(
    existingEntries.map((e) => `${e.kind}::${e.title}`),
  );

  for (const entry of SEED_BIO) {
    const key = `${entry.kind}::${entry.title}`;
    if (existingKeys.has(key)) {
      continue;
    }
    await ctx.db.insert("bioEntries", {
      userId,
      kind: entry.kind,
      title: entry.title,
      startDate: entry.startDate,
      endDate: entry.endDate,
      description: entry.description,
    });
  }
}
