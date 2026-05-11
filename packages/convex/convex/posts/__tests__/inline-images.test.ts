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
import { type Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { normalizeConvexTestModules } from "../../__tests__/testUtils";

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexTestModules(rawModules, {
  sourceDir: "posts",
});

function makeT() {
  return convexTest(schema, modules);
}

async function insertAppUserAndSignIn(
  t: ReturnType<typeof makeT>,
  authId = "auth_posts_inline",
  email = "posts-inline@example.com",
) {
  const appUserId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email,
      onboardingComplete: true,
    }),
  );
  authState.currentAuthUser = { _id: authId };
  return appUserId;
}

async function storeBlob(
  t: ReturnType<typeof makeT>,
  contents = "test",
): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob([contents]));
  });
}

// Mirror of the articles-side helper. Insert a `coverImageOwnership` row
// for the given storageId so `posts.mutations.create`/`update`'s
// `assertCoverBlobOwnership` check passes when the test bypasses the
// usual upload-then-claim flow.
async function seedCoverOwnership(
  t: ReturnType<typeof makeT>,
  storageId: Id<"_storage">,
  authId: string,
): Promise<void> {
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authId))
      .unique();
    if (!user) throw new Error(`No app user for authId=${authId}`);
    await ctx.db.insert("coverImageOwnership", {
      storageId,
      userId: user._id,
      createdAt: Date.now(),
      kind: "image",
    });
  });
}

async function blobExists(
  t: ReturnType<typeof makeT>,
  id: Id<"_storage">,
): Promise<boolean> {
  return await t.run(async (ctx) => {
    const meta = await ctx.db.system.get(id);
    return meta !== null;
  });
}

function imageNode(storageId: string, src = "https://example/old") {
  return { type: "image", attrs: { storageId, src } };
}

function bodyWithImages(...storageIds: string[]) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: storageIds.map((id) => imageNode(id)),
      },
    ],
  };
}

describe("posts.inlineImages — generatePostInlineImageUploadUrl (FR-02, FR-12)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("returns a URL when authed", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const url = await t.mutation(
      api.posts.inlineImages.generatePostInlineImageUploadUrl,
      {},
    );
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });

  it("throws when not authed", async () => {
    const t = makeT();
    await expect(
      t.mutation(api.posts.inlineImages.generatePostInlineImageUploadUrl, {}),
    ).rejects.toThrow(/not authenticated/i);
  });
});

describe("posts.inlineImages — getPostInlineImageUrl (FR-02, FR-12)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("returns URL for valid storageId when authed", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await storeBlob(t);
    const url = await t.query(api.posts.inlineImages.getPostInlineImageUrl, {
      storageId: id,
    });
    expect(url).toBeTypeOf("string");
  });

  it("returns null for a storageId whose blob has been deleted", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await storeBlob(t);
    await t.run(async (ctx) => ctx.storage.delete(id));
    const url = await t.query(api.posts.inlineImages.getPostInlineImageUrl, {
      storageId: id,
    });
    expect(url).toBeNull();
  });

  it("throws when not authed", async () => {
    const t = makeT();
    const id = await storeBlob(t);
    await expect(
      t.query(api.posts.inlineImages.getPostInlineImageUrl, {
        storageId: id,
      }),
    ).rejects.toThrow(/not authenticated/i);
  });
});

describe("posts.mutations.update — inline-image cascade (FR-06, NFR-06)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("removes 1 storage blob when one of two distinct images is deleted", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const a = await storeBlob(t, "a");
    const b = await storeBlob(t, "b");

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Two",
      category: "Creativity",
      body: bodyWithImages(a, b),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.update, {
      id: postId,
      body: bodyWithImages(a),
    });

    expect(await blobExists(t, a)).toBe(true);
    expect(await blobExists(t, b)).toBe(false);
  });

  it("removes 0 blobs when one duplicate of a duplicated image is removed (multiset)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const dup = await storeBlob(t, "dup");

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Dup",
      category: "Creativity",
      body: bodyWithImages(dup, dup),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.update, {
      id: postId,
      body: bodyWithImages(dup),
    });

    expect(await blobExists(t, dup)).toBe(true);
  });

  it("update removes 1 blob when the only copy is deleted (multiset boundary case 3)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const only = await storeBlob(t, "only");

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Only",
      category: "Creativity",
      body: bodyWithImages(only),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.update, {
      id: postId,
      body: bodyWithImages(),
    });

    expect(await blobExists(t, only)).toBe(false);
  });

  it("delete-after-patch: storage delete fires after the body patch is committed", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const a = await storeBlob(t, "a");

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Order",
      category: "Creativity",
      body: bodyWithImages(a),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.update, {
      id: postId,
      body: bodyWithImages(),
    });

    const post = await t.run(async (ctx) => ctx.db.get(postId));
    expect(post?.body).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    });
    expect(await blobExists(t, a)).toBe(false);
  });

  // Stronger ordering proof: trigger a pre-patch validation throw and assert
  // the inline blob was NOT deleted. If a future refactor moves
  // `ctx.storage.delete` BEFORE `ctx.db.patch`, this test fails.
  it("delete-after-patch: when the patch path throws, no inline blob is deleted", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const a = await storeBlob(t, "a");

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Order2",
      category: "Creativity",
      body: bodyWithImages(a),
      status: "draft",
    });

    const tooLong = "x".repeat(101); // MAX_POST_CATEGORY_LENGTH = 100
    await expect(
      t.mutation(api.posts.mutations.update, {
        id: postId,
        category: tooLong,
        body: bodyWithImages(),
      }),
    ).rejects.toThrow(/Category exceeds maximum length/);

    expect(await blobExists(t, a)).toBe(true);
  });

  it("caps inline deletes at 50 per invocation (NFR-06)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const ids: Id<"_storage">[] = [];
    for (let i = 0; i < 60; i++) {
      ids.push(await storeBlob(t, `b-${i}`));
    }

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Big",
      category: "Creativity",
      body: bodyWithImages(...ids),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.update, {
      id: postId,
      body: bodyWithImages(),
    });

    let alive = 0;
    for (const id of ids) {
      if (await blobExists(t, id)) alive += 1;
    }
    expect(alive).toBe(10);
  });
});

// FG_091: cross-user storage-deletion attack — posts mirror.
// See `articles/__tests__/inline-images.test.ts` for the full attack
// description.
describe("posts.mutations — cross-user inline-image deletion guard (FG_091)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("update: user B cannot delete user A's storage blob by embedding+removing A's storageId", async () => {
    const t = makeT();

    const userAAppId = await insertAppUserAndSignIn(
      t,
      "auth_user_a",
      "user-a@example.com",
    );
    const sA = await storeBlob(t, "user-a-blob");
    const aPostId = await t.mutation(api.posts.mutations.create, {
      title: "User A's post",
      category: "Creativity",
      body: bodyWithImages(sA),
      status: "published",
    });

    const userBAppId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_user_b",
        email: "user-b@example.com",
        onboardingComplete: true,
      }),
    );
    authState.currentAuthUser = { _id: "auth_user_b" };
    const bPostId = await t.mutation(api.posts.mutations.create, {
      title: "User B's post",
      category: "Creativity",
      body: bodyWithImages(sA),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.update, {
      id: bPostId,
      body: bodyWithImages(),
    });

    expect(await blobExists(t, sA)).toBe(true);

    const aPostAfter = await t.run(async (ctx) => ctx.db.get(aPostId));
    expect(extractInlineIdsFromBody(aPostAfter?.body)).toContain(sA);

    const ownership = await t.run(async (ctx) =>
      ctx.db
        .query("inlineImageOwnership")
        .withIndex("by_storageId", (q) => q.eq("storageId", sA))
        .unique(),
    );
    expect(ownership?.userId).toBe(userAAppId);
    expect(ownership?.userId).not.toBe(userBAppId);
  });

  it("remove: user B deleting their own post (which referenced A's storageId) does not delete A's blob", async () => {
    const t = makeT();

    await insertAppUserAndSignIn(t, "auth_user_a", "user-a@example.com");
    const sA = await storeBlob(t, "user-a-blob");
    await t.mutation(api.posts.mutations.create, {
      title: "User A's post",
      category: "Creativity",
      body: bodyWithImages(sA),
      status: "published",
    });

    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_user_b",
        email: "user-b@example.com",
        onboardingComplete: true,
      }),
    );
    authState.currentAuthUser = { _id: "auth_user_b" };
    const bPostId = await t.mutation(api.posts.mutations.create, {
      title: "User B's post",
      category: "Creativity",
      body: bodyWithImages(sA),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.remove, { ids: [bPostId] });

    expect(await blobExists(t, sA)).toBe(true);
  });

  it("update: legitimate same-user removal still deletes the blob (regression)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const owned = await storeBlob(t, "owned");
    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Same user",
      category: "Creativity",
      body: bodyWithImages(owned),
      status: "draft",
    });

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("inlineImageOwnership")
        .withIndex("by_storageId", (q) => q.eq("storageId", owned))
        .unique();
      expect(row).not.toBeNull();
    });

    await t.mutation(api.posts.mutations.update, {
      id: postId,
      body: bodyWithImages(),
    });

    expect(await blobExists(t, owned)).toBe(false);
  });

  it("update: same-user copied storageId is preserved while another post still references it", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const shared = await storeBlob(t, "shared");
    const originalPostId = await t.mutation(api.posts.mutations.create, {
      title: "Original",
      category: "Creativity",
      body: bodyWithImages(shared),
      status: "draft",
    });
    const copiedPostId = await t.mutation(api.posts.mutations.create, {
      title: "Copied",
      category: "Creativity",
      body: bodyWithImages(shared),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.update, {
      id: copiedPostId,
      body: bodyWithImages(),
    });

    expect(await blobExists(t, shared)).toBe(true);
    const original = await t.run(async (ctx) => ctx.db.get(originalPostId));
    expect(extractInlineIdsFromBody(original?.body)).toContain(shared);
  });

  it("update: legacy storageId (no ownership row) is tolerated — silently skipped, not deleted", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const legacy = await storeBlob(t, "legacy");
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        userId: (
          await ctx.db
            .query("users")
            .withIndex("by_authId", (q) =>
              q.eq("authId", "auth_posts_inline"),
            )
            .unique()
        )!._id,
        slug: "legacy-post",
        title: "Legacy",
        category: "Creativity",
        body: bodyWithImages(legacy),
        status: "draft",
        createdAt: Date.now(),
      }),
    );

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("inlineImageOwnership")
        .withIndex("by_storageId", (q) => q.eq("storageId", legacy))
        .unique();
      expect(row).toBeNull();
    });

    await t.mutation(api.posts.mutations.update, {
      id: postId,
      body: bodyWithImages(),
    });

    expect(await blobExists(t, legacy)).toBe(true);
  });
});

// Local helper — see articles test for rationale.
function extractInlineIdsFromBody(body: unknown): string[] {
  const out: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "image") {
      const attrs = n.attrs as { storageId?: unknown } | undefined;
      const id = attrs?.storageId;
      if (typeof id === "string" && id.length > 0) out.push(id);
    }
    const children = n.content;
    if (Array.isArray(children)) {
      for (const c of children) walk(c);
    }
  }
  walk(body);
  return out;
}

describe("posts.mutations.remove — inline-image cascade (FR-07, NFR-06)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("deletes 3 inline blobs + 1 cover blob", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const cover = await storeBlob(t, "cover");
    const i1 = await storeBlob(t, "i1");
    const i2 = await storeBlob(t, "i2");
    const i3 = await storeBlob(t, "i3");
    // FG_147 / cover-blob ownership: posts.mutations.create now verifies a
    // matching coverImageOwnership row before writing coverImageStorageId.
    // Tests that bypass the upload-then-claim flow must seed the row.
    await seedCoverOwnership(t, cover, "auth_posts_inline");

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Doomed",
      category: "Creativity",
      body: bodyWithImages(i1, i2, i3),
      status: "draft",
      coverImageStorageId: cover,
    });

    await t.mutation(api.posts.mutations.remove, { ids: [postId] });

    expect(await blobExists(t, cover)).toBe(false);
    expect(await blobExists(t, i1)).toBe(false);
    expect(await blobExists(t, i2)).toBe(false);
    expect(await blobExists(t, i3)).toBe(false);
  });

  it("skips inline image nodes that have no storageId (legacy external URLs)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    // Bypass the FG_148 external-src rejection by writing the legacy row
    // directly. Editor-authored bodies always set storageId for inserted
    // images; this scenario only exists for rows that pre-date the guard.
    const postId = await t.run(async (ctx) => {
      const owner = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", "auth_posts_inline"))
        .unique();
      if (!owner) throw new Error("test setup: missing owner");
      return await ctx.db.insert("posts", {
        userId: owner._id,
        slug: "legacy-only",
        title: "Legacy only",
        category: "Creativity",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "image",
                  attrs: { src: "https://external/legacy.png" },
                },
                {
                  type: "image",
                  attrs: { src: "https://external/another.png" },
                },
              ],
            },
          ],
        },
        status: "draft",
        createdAt: Date.now(),
      });
    });

    await t.mutation(api.posts.mutations.remove, { ids: [postId] });

    const after = await t.run(async (ctx) => ctx.db.get(postId));
    expect(after).toBeNull();
  });

  it("caps inline deletes at 50 per invocation (NFR-06)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const ids: Id<"_storage">[] = [];
    for (let i = 0; i < 60; i++) {
      ids.push(await storeBlob(t, `b-${i}`));
    }

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Many",
      category: "Creativity",
      body: bodyWithImages(...ids),
      status: "draft",
    });

    await t.mutation(api.posts.mutations.remove, { ids: [postId] });

    let alive = 0;
    for (const id of ids) {
      if (await blobExists(t, id)) alive += 1;
    }
    expect(alive).toBe(10);
  });
});
