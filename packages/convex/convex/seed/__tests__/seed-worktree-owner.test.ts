/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported. `convex/env.ts`
// validates these at module-load time and throws otherwise.
process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { type Id } from "../../_generated/dataModel";

// Stub the agent component. `ensureRickRubinConversations` calls
// `createThread` + `saveMessage` once per SEED_CONVERSATIONS row; the real
// implementations bind to `components.agent`, which isn't wired up under
// `convex-test`. The stubs return stable fake values that our assertions
// can ignore (we only inspect rows in our own tables, not agent component
// state).
vi.mock("@convex-dev/agent", () => {
  return {
    createThread: vi.fn(async () => "thread_x"),
    saveMessage: vi.fn(async () => ({ messageId: "msg_x" })),
    listMessages: vi.fn(async () => ({
      page: [],
      isDone: true,
      continueCursor: "",
    })),
    Agent: class {
      async continueThread() {
        return {
          thread: { streamText: vi.fn(async () => undefined) },
        };
      }
    },
  };
});

vi.mock("ai", () => {
  return {
    embed: vi.fn(async () => ({ embedding: new Array(768).fill(0.01) })),
    embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => new Array(768).fill(0.01)),
    })),
  };
});

vi.mock("@ai-sdk/google", () => {
  return {
    google: {
      textEmbeddingModel: vi.fn(() => ({})),
    },
  };
});

import { internal } from "../../_generated/api";
import schema from "../../schema";
import {
  SEED_ARTICLES,
  SEED_BIO,
  SEED_CONVERSATIONS,
  SEED_OWNER_PROFILE,
  SEED_POSTS,
} from "../data";

// Vite's `import.meta.glob` normalizes keys to the shortest possible
// relative path from the importing file, which gives mixed prefixes when
// the test lives in a nested __tests__/ dir. `convex-test` needs a single
// uniform prefix rooted at the `_generated/` entry, so we rewrite every
// key to start with `../../<dir>/...` (relative to the convex/ root when
// viewed from here).
function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../seed/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../seed/" + k.slice(3);
    }
    out[k] = loader;
  }
  return out;
}

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawModules);

function makeT() {
  return convexTest(schema, modules);
}

async function insertWorktreeOwner(
  t: ReturnType<typeof makeT>,
  email: string,
  // `null` represents the fresh-sign-in state (no username, onboarding
  // pending). A string sets username + marks onboarding complete.
  username: string | null = "worktree-owner",
): Promise<Id<"users">> {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId: `auth_${username ?? "no-username"}`,
      email,
      ...(username !== null ? { username } : {}),
      ...(username !== null ? { name: "Worktree Owner" } : {}),
      onboardingComplete: username !== null,
    }),
  );
}

describe("seed.seedWorktreeOwnerDemo", () => {
  it("throws when no `users` row matches the supplied email", async () => {
    const t = makeT();

    await expect(
      t.mutation(internal.seed.seedWorktreeOwnerDemo, {
        email: "noone@example.com",
      }),
    ).rejects.toThrow(/no `users` row/);
  });

  it("returns the matching user's _id on success", async () => {
    const t = makeT();
    const ownerId = await insertWorktreeOwner(
      t,
      "worktree-owner@example.com",
    );

    const result = await t.mutation(internal.seed.seedWorktreeOwnerDemo, {
      email: "worktree-owner@example.com",
    });

    expect(result).toBe(ownerId);
  });

  it("inserts article/post/conversation/bio fixtures under the matching user", async () => {
    const t = makeT();
    const ownerId = await insertWorktreeOwner(
      t,
      "worktree-owner@example.com",
    );

    await t.mutation(internal.seed.seedWorktreeOwnerDemo, {
      email: "worktree-owner@example.com",
    });

    const articles = await t.run(async (ctx) =>
      ctx.db
        .query("articles")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect(),
    );
    expect(articles).toHaveLength(SEED_ARTICLES.length);
    expect(articles.every((a) => a.userId === ownerId)).toBe(true);

    const posts = await t.run(async (ctx) =>
      ctx.db
        .query("posts")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect(),
    );
    expect(posts).toHaveLength(SEED_POSTS.length);
    expect(posts.every((p) => p.userId === ownerId)).toBe(true);

    const conversations = await t.run(async (ctx) =>
      ctx.db
        .query("conversations")
        .withIndex("by_profileOwnerId_and_viewerId", (q) =>
          q.eq("profileOwnerId", ownerId),
        )
        .collect(),
    );
    expect(conversations).toHaveLength(SEED_CONVERSATIONS.length);
    expect(conversations.every((c) => c.profileOwnerId === ownerId)).toBe(
      true,
    );

    const bio = await t.run(async (ctx) =>
      ctx.db
        .query("bioEntries")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect(),
    );
    expect(bio).toHaveLength(SEED_BIO.length);
    expect(bio.every((b) => b.userId === ownerId)).toBe(true);
  });

  it("patches profile fields on a fresh sign-in (no username, onboardingComplete:false)", async () => {
    const t = makeT();
    // Simulate Better Auth's user.onCreate: row exists but onboarding has
    // not run yet (no username, no name, no tagline, onboardingComplete:false).
    const ownerId = await insertWorktreeOwner(
      t,
      "hpark0011@gmail.com",
      null, // fresh sign-in: no username, onboarding pending
    );

    await t.mutation(internal.seed.seedWorktreeOwnerDemo, {
      email: "hpark0011@gmail.com",
      name: "Hyunsol Park",
    });

    const owner = await t.run(async (ctx) => ctx.db.get(ownerId));
    expect(owner?.username).toBe("hpark0011");
    expect(owner?.name).toBe("Hyunsol Park");
    expect(owner?.tagline).toBe(SEED_OWNER_PROFILE.tagline);
    expect(owner?.onboardingComplete).toBe(true);
  });

  it("does not overwrite profile fields the owner has already set", async () => {
    const t = makeT();
    const ownerId = await insertWorktreeOwner(
      t,
      "worktree-owner@example.com",
      "custom-handle",
    );
    // Pre-populate tagline so we can prove the seed leaves it alone.
    await t.run(async (ctx) =>
      ctx.db.patch(ownerId, { tagline: "my real tagline" }),
    );

    await t.mutation(internal.seed.seedWorktreeOwnerDemo, {
      email: "worktree-owner@example.com",
      name: "Should Not Overwrite",
    });

    const owner = await t.run(async (ctx) => ctx.db.get(ownerId));
    expect(owner?.username).toBe("custom-handle");
    expect(owner?.name).toBe("Worktree Owner");
    expect(owner?.tagline).toBe("my real tagline");
    expect(owner?.onboardingComplete).toBe(true);
  });

  it("matches the email case-insensitively", async () => {
    const t = makeT();
    // Insert with mixed-case email (Better Auth persists `doc.email`
    // verbatim — see auth/client.ts:84). Caller passes lowercase. The
    // mutation lowercases both sides before comparing.
    const ownerId = await insertWorktreeOwner(
      t,
      "Worktree-Owner@Example.com",
    );

    const result = await t.mutation(internal.seed.seedWorktreeOwnerDemo, {
      email: "worktree-owner@example.com",
    });

    expect(result).toBe(ownerId);
  });

  it("is idempotent — re-running does not duplicate rows", async () => {
    const t = makeT();
    const ownerId = await insertWorktreeOwner(
      t,
      "worktree-owner@example.com",
    );

    // First run.
    await t.mutation(internal.seed.seedWorktreeOwnerDemo, {
      email: "worktree-owner@example.com",
    });

    const countsAfterFirstRun = await t.run(async (ctx) => {
      const articles = await ctx.db
        .query("articles")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect();
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect();
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_profileOwnerId_and_viewerId", (q) =>
          q.eq("profileOwnerId", ownerId),
        )
        .collect();
      const bio = await ctx.db
        .query("bioEntries")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect();
      return {
        articles: articles.length,
        posts: posts.length,
        conversations: conversations.length,
        bio: bio.length,
      };
    });

    // Second run with the same email.
    await t.mutation(internal.seed.seedWorktreeOwnerDemo, {
      email: "worktree-owner@example.com",
    });

    const countsAfterSecondRun = await t.run(async (ctx) => {
      const articles = await ctx.db
        .query("articles")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect();
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect();
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_profileOwnerId_and_viewerId", (q) =>
          q.eq("profileOwnerId", ownerId),
        )
        .collect();
      const bio = await ctx.db
        .query("bioEntries")
        .withIndex("by_userId", (q) => q.eq("userId", ownerId))
        .collect();
      return {
        articles: articles.length,
        posts: posts.length,
        conversations: conversations.length,
        bio: bio.length,
      };
    });

    // The contract: "row count after second run equals row count after
    // first run". This holds under both the legacy "any-row → bail"
    // helper logic and the per-slug / per-title logic Executor A is
    // shipping in parallel.
    expect(countsAfterSecondRun).toEqual(countsAfterFirstRun);
  });
});
