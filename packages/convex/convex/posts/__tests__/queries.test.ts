/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";

const authState = {
  currentAuthUser: null as { _id: string } | null,
};

vi.mock("../../auth/client", () => {
  return {
    authComponent: {
      getAuthUser: vi.fn(async () => {
        if (!authState.currentAuthUser) {
          throw new Error("Not authenticated");
        }
        return authState.currentAuthUser;
      }),
      safeGetAuthUser: vi.fn(async () => authState.currentAuthUser),
    },
  };
});

import { api } from "../../_generated/api";
import schema from "../../schema";

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../posts/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../posts/" + k.slice(3);
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

async function setupOwnerAndSignIn(t: ReturnType<typeof makeT>) {
  const authId = "auth_posts_query";
  await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: "owner@example.com",
      username: "owner",
      onboardingComplete: true,
    }),
  );
  authState.currentAuthUser = { _id: authId };
  return { authId };
}

async function storeBlob(t: ReturnType<typeof makeT>, contents = "x") {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([contents])));
}

describe("posts.queries.getBySlug — inline image src rewrite (FR-05)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("rewrites image node src to a Convex-served URL when storageId is set", async () => {
    const t = makeT();
    await setupOwnerAndSignIn(t);
    const storageId = await storeBlob(t, "img");

    await t.mutation(api.posts.mutations.create, {
      title: "With image",
      slug: "with-image",
      category: "Creativity",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { storageId, src: "stale://placeholder" },
              },
            ],
          },
        ],
      },
      status: "published",
    });

    const result = await t.query(api.posts.queries.getBySlug, {
      username: "owner",
      slug: "with-image",
    });
    const node = (
      result?.body as {
        content: { content: { attrs: Record<string, unknown> }[] }[];
      }
    ).content[0].content[0];
    expect(node.attrs.storageId).toBe(storageId);
    expect(node.attrs.src).not.toBe("stale://placeholder");
    expect(typeof node.attrs.src).toBe("string");
  });

  it("leaves src untouched when storageId is absent (legacy external URL passthrough)", async () => {
    const t = makeT();
    const { authId } = await setupOwnerAndSignIn(t);

    // Bypass the public mutation's FG_148 external-src rejection by writing
    // the legacy row directly. Editor-authored bodies always set storageId
    // for inserted images, but rows persisted before that guard existed
    // can still appear in production data — query-side rewrite should pass
    // them through unchanged.
    await t.run(async (ctx) => {
      const owner = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authId))
        .unique();
      if (!owner) throw new Error("test setup: missing owner");
      await ctx.db.insert("posts", {
        userId: owner._id,
        slug: "legacy",
        title: "Legacy",
        category: "Creativity",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "image",
                  attrs: { src: "https://legacy.example/old.png" },
                },
              ],
            },
          ],
        },
        status: "published",
        createdAt: Date.now(),
        publishedAt: Date.now(),
      });
    });

    const result = await t.query(api.posts.queries.getBySlug, {
      username: "owner",
      slug: "legacy",
    });
    const node = (
      result?.body as {
        content: { content: { attrs: Record<string, unknown> }[] }[];
      }
    ).content[0].content[0];
    expect(node.attrs.src).toBe("https://legacy.example/old.png");
    expect(node.attrs.storageId).toBeUndefined();
  });
});

describe("posts.queries.getByUsername — draft/published visibility (FG_248/FG_255)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("non-owner sees only published posts (draft hidden)", async () => {
    const t = makeT();
    await setupOwnerAndSignIn(t);

    // Create one draft and one published post as the owner.
    await t.mutation(api.posts.mutations.create, {
      title: "Draft Post",
      slug: "draft-post",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });
    await t.mutation(api.posts.mutations.create, {
      title: "Published Post",
      slug: "published-post",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "published",
    });

    // Sign out so the caller is a non-owner.
    authState.currentAuthUser = null;

    const list = await t.query(api.posts.queries.getByUsername, {
      username: "owner",
    });

    expect(list).not.toBeNull();
    expect(list!).toHaveLength(1);
    expect(list![0]!.status).toBe("published");
    expect(list![0]!.slug).toBe("published-post");
  });

  it("owner sees all posts including drafts", async () => {
    const t = makeT();
    const { authId } = await setupOwnerAndSignIn(t);

    // Create one draft and one published post as the owner.
    await t.mutation(api.posts.mutations.create, {
      title: "Draft Post",
      slug: "draft-post",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });
    await t.mutation(api.posts.mutations.create, {
      title: "Published Post",
      slug: "published-post",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "published",
    });

    // Stay signed in as the owner.
    authState.currentAuthUser = { _id: authId };

    const list = await t.query(api.posts.queries.getByUsername, {
      username: "owner",
    });

    expect(list).not.toBeNull();
    expect(list!).toHaveLength(2);
    const slugs = list!.map((p) => p.slug).sort();
    expect(slugs).toEqual(["draft-post", "published-post"]);
  });
});

describe("posts.queries.getByUsername — inline image src rewrite (FG_093)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("rewrites image node src to a fresh Convex-served URL for posts in the list view", async () => {
    const t = makeT();
    await setupOwnerAndSignIn(t);
    const storageId = await storeBlob(t, "img-list");

    await t.mutation(api.posts.mutations.create, {
      title: "List view image",
      slug: "list-image",
      category: "Creativity",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { storageId, src: "stale://placeholder" },
              },
            ],
          },
        ],
      },
      status: "published",
    });

    // Compute the fresh signed URL the query should produce.
    const expectedUrl = await t.run(async (ctx) =>
      ctx.storage.getUrl(storageId),
    );
    expect(typeof expectedUrl).toBe("string");

    const list = await t.query(api.posts.queries.getByUsername, {
      username: "owner",
    });
    expect(list).not.toBeNull();
    expect(list!).toHaveLength(1);
    const post = list![0]!;
    const node = (
      post.body as {
        content: { content: { attrs: Record<string, unknown> }[] }[];
      }
    ).content[0].content[0];
    expect(node.attrs.storageId).toBe(storageId);
    expect(node.attrs.src).not.toBe("stale://placeholder");
    expect(node.attrs.src).toBe(expectedUrl);
  });
});
