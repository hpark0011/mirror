/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported. `convex/env.ts`
// validates these at module-load time and throws otherwise; transitively
// imported modules (auth client, etc.) pull it in.
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

// Mock safe-fetch so the action's external fetch is deterministic.
const safeFetchMock = vi.fn();
vi.mock("../../content/safe-fetch", () => {
  // Re-export `SafeFetchError` shape so the action's `instanceof` check still
  // works with thrown mock errors.
  class SafeFetchError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "SafeFetchError";
    }
  }
  return {
    safeFetchImage: (...args: unknown[]) => safeFetchMock(...args),
    SafeFetchError,
  };
});

import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../articles/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../articles/" + k.slice(3);
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

async function insertAppUserAndSignIn(
  t: ReturnType<typeof makeT>,
  authId = "auth_articles_inline",
  email = "articles-inline@example.com",
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

describe("articles.inlineImages — generateArticleInlineImageUploadUrl (FR-02, FR-12)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("returns a URL when authed", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const url = await t.mutation(
      api.articles.inlineImages.generateArticleInlineImageUploadUrl,
      {},
    );
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });

  it("throws when not authed", async () => {
    const t = makeT();
    await expect(
      t.mutation(
        api.articles.inlineImages.generateArticleInlineImageUploadUrl,
        {},
      ),
    ).rejects.toThrow(/not authenticated/i);
  });
});

describe("articles.inlineImages — getArticleInlineImageUrl (FR-02, FR-12)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("returns URL for valid storageId when authed", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await storeBlob(t);
    const url = await t.query(
      api.articles.inlineImages.getArticleInlineImageUrl,
      { storageId: id },
    );
    expect(url).toBeTypeOf("string");
  });

  it("returns null for a storageId whose blob has been deleted", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await storeBlob(t);
    // Delete the blob so getUrl returns null.
    await t.run(async (ctx) => ctx.storage.delete(id));
    const url = await t.query(
      api.articles.inlineImages.getArticleInlineImageUrl,
      { storageId: id },
    );
    expect(url).toBeNull();
  });

  it("throws when not authed", async () => {
    const t = makeT();
    const id = await storeBlob(t);
    await expect(
      t.query(api.articles.inlineImages.getArticleInlineImageUrl, {
        storageId: id,
      }),
    ).rejects.toThrow(/not authenticated/i);
  });
});

describe("articles.mutations.update — inline-image cascade (FR-06, NFR-06)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("removes 1 storage blob when one of two distinct images is deleted", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const a = await storeBlob(t, "a");
    const b = await storeBlob(t, "b");

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Two images",
      category: "general",
      body: bodyWithImages(a, b),
      status: "draft",
    });

    // Update body to keep only `a`. Expect `b` to be deleted.
    await t.mutation(api.articles.mutations.update, {
      id: articleId,
      body: bodyWithImages(a),
    });

    expect(await blobExists(t, a)).toBe(true);
    expect(await blobExists(t, b)).toBe(false);
  });

  it("removes 0 blobs when one duplicate of a duplicated image is removed (multiset)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const dup = await storeBlob(t, "dup");

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Dup",
      category: "general",
      body: bodyWithImages(dup, dup),
      status: "draft",
    });

    // Remove one occurrence — the other still references the same blob.
    await t.mutation(api.articles.mutations.update, {
      id: articleId,
      body: bodyWithImages(dup),
    });

    expect(await blobExists(t, dup)).toBe(true);
  });

  it("update removes 1 blob when the only copy is deleted (multiset boundary case 3)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const only = await storeBlob(t, "only");

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Only",
      category: "general",
      body: bodyWithImages(only),
      status: "draft",
    });

    // Update body to remove the sole reference.
    await t.mutation(api.articles.mutations.update, {
      id: articleId,
      body: bodyWithImages(),
    });

    expect(await blobExists(t, only)).toBe(false);
  });

  it("delete-after-patch: storage delete fires after the body patch is committed", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const a = await storeBlob(t, "a");

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Order",
      category: "general",
      body: bodyWithImages(a),
      status: "draft",
    });

    await t.mutation(api.articles.mutations.update, {
      id: articleId,
      body: bodyWithImages(),
    });

    // After the mutation: body must show no inline IDs AND blob is gone.
    const article = await t.run(async (ctx) => ctx.db.get(articleId));
    expect(article?.body).toEqual({
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

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Order2",
      category: "general",
      body: bodyWithImages(a),
      status: "draft",
    });

    // Oversize category: `validateContentStringLength` throws early in the
    // update handler — well before `ctx.db.patch` runs. If the inline-image
    // delete were ordered BEFORE the patch (or before validation), `a`
    // would be deleted here. We assert it survives.
    const tooLong = "x".repeat(101); // MAX_CATEGORY_LENGTH = 100
    await expect(
      t.mutation(api.articles.mutations.update, {
        id: articleId,
        category: tooLong,
        body: bodyWithImages(),
      }),
    ).rejects.toThrow(/Category exceeds maximum length/);

    expect(await blobExists(t, a)).toBe(true);
  });

  it("caps inline deletes at 50 per invocation; remaining 10 left for cron sweep (NFR-06)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    // Seed 60 distinct blobs and reference them all in the body.
    const ids: Id<"_storage">[] = [];
    for (let i = 0; i < 60; i++) {
      ids.push(await storeBlob(t, `b-${i}`));
    }

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Big",
      category: "general",
      body: bodyWithImages(...ids),
      status: "draft",
    });

    // Empty the body. All 60 should be diff-removed; only 50 deleted.
    await t.mutation(api.articles.mutations.update, {
      id: articleId,
      body: bodyWithImages(),
    });

    let alive = 0;
    for (const id of ids) {
      if (await blobExists(t, id)) alive += 1;
    }
    expect(alive).toBe(10);
  });
});

// FG_091: cross-user storage-deletion attack. The vulnerability: a public
// article body containing user A's storageId can be embedded in user B's
// own draft body, and a follow-up `update` removing the storageId would
// previously call `ctx.storage.delete(<A's blob>)` on A's behalf — A's
// blob was permanently destroyed by B's mutation.
//
// Mitigation: the `inlineImageOwnership` table records who first
// committed each storageId. `update` and `remove` filter the
// removed-storage-IDs set to ones the table attributes to the current
// caller. Legacy IDs (no ownership row) are silently skipped.
describe("articles.mutations — cross-user inline-image deletion guard (FG_091)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("update: user B cannot delete user A's storage blob by embedding+removing A's storageId", async () => {
    const t = makeT();

    // User A creates an article whose body references storageId `sA`.
    // Ownership of `sA` is claimed for A on commit.
    const userAAppId = await insertAppUserAndSignIn(
      t,
      "auth_user_a",
      "user-a@example.com",
    );
    const sA = await storeBlob(t, "user-a-blob");
    const aArticleId = await t.mutation(api.articles.mutations.create, {
      title: "User A's article",
      category: "general",
      body: bodyWithImages(sA),
      status: "published",
    });

    // User B copies `sA` (read off A's published article body) into their
    // own draft body. B's `create` does NOT transfer ownership — the
    // ownership row for `sA` still attributes the blob to A.
    const userBAppId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_user_b",
        email: "user-b@example.com",
        onboardingComplete: true,
      }),
    );
    authState.currentAuthUser = { _id: "auth_user_b" };
    const bArticleId = await t.mutation(api.articles.mutations.create, {
      title: "User B's article",
      category: "general",
      body: bodyWithImages(sA),
      status: "draft",
    });

    // User B updates their article with an empty body. Without the
    // ownership guard, `removedInlineIds` would include `sA` and
    // `ctx.storage.delete(sA)` would fire — destroying A's blob. With
    // the guard, the filter drops `sA` because the table attributes it
    // to A, not to B.
    await t.mutation(api.articles.mutations.update, {
      id: bArticleId,
      body: bodyWithImages(),
    });

    // Assertion: A's blob still exists.
    expect(await blobExists(t, sA)).toBe(true);

    // A's article still references the blob; A can still resolve it.
    const aArticleAfter = await t.run(async (ctx) =>
      ctx.db.get(aArticleId),
    );
    expect(
      extractInlineIdsFromArticleBody(aArticleAfter?.body),
    ).toContain(sA);

    // Sanity: ownership table still attributes `sA` to A.
    const ownership = await t.run(async (ctx) =>
      ctx.db
        .query("inlineImageOwnership")
        .withIndex("by_storageId", (q) => q.eq("storageId", sA))
        .unique(),
    );
    expect(ownership?.userId).toBe(userAAppId);

    // Defensive: confirm B's app user id is not the owner of `sA` (would
    // mean ownership was overwritten — first-commit contract violated).
    expect(ownership?.userId).not.toBe(userBAppId);
  });

  it("remove: user B deleting their own article (which referenced A's storageId) does not delete A's blob", async () => {
    const t = makeT();

    // User A claims `sA`.
    await insertAppUserAndSignIn(t, "auth_user_a", "user-a@example.com");
    const sA = await storeBlob(t, "user-a-blob");
    await t.mutation(api.articles.mutations.create, {
      title: "User A's article",
      category: "general",
      body: bodyWithImages(sA),
      status: "published",
    });

    // User B creates an article referencing A's `sA`.
    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_user_b",
        email: "user-b@example.com",
        onboardingComplete: true,
      }),
    );
    authState.currentAuthUser = { _id: "auth_user_b" };
    const bArticleId = await t.mutation(api.articles.mutations.create, {
      title: "User B's article",
      category: "general",
      body: bodyWithImages(sA),
      status: "draft",
    });

    // B removes their article. The cascade-delete walks `sA` but the
    // ownership table attributes it to A — guard drops it before the
    // `ctx.storage.delete` call.
    await t.mutation(api.articles.mutations.remove, { ids: [bArticleId] });

    expect(await blobExists(t, sA)).toBe(true);
  });

  it("update: legitimate same-user removal still deletes the blob (regression)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const owned = await storeBlob(t, "owned");
    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Same user",
      category: "general",
      body: bodyWithImages(owned),
      status: "draft",
    });

    // Sanity: claim was recorded for the caller.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("inlineImageOwnership")
        .withIndex("by_storageId", (q) => q.eq("storageId", owned))
        .unique();
      expect(row).not.toBeNull();
    });

    await t.mutation(api.articles.mutations.update, {
      id: articleId,
      body: bodyWithImages(),
    });

    expect(await blobExists(t, owned)).toBe(false);
  });

  it("update: legacy storageId (no ownership row) is tolerated — silently skipped, not deleted", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    // Simulate a legacy body row by directly inserting a blob and an
    // article whose body references it WITHOUT going through the
    // mutation that would have claimed ownership.
    const legacy = await storeBlob(t, "legacy");
    const articleId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId: (
          await ctx.db
            .query("users")
            .withIndex("by_authId", (q) =>
              q.eq("authId", "auth_articles_inline"),
            )
            .unique()
        )!._id,
        slug: "legacy-article",
        title: "Legacy",
        category: "general",
        body: bodyWithImages(legacy),
        status: "draft",
        createdAt: Date.now(),
      }),
    );

    // Confirm precondition: no ownership row exists.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("inlineImageOwnership")
        .withIndex("by_storageId", (q) => q.eq("storageId", legacy))
        .unique();
      expect(row).toBeNull();
    });

    await t.mutation(api.articles.mutations.update, {
      id: articleId,
      body: bodyWithImages(),
    });

    // Constraint: legacy bodies tolerated silently; blob NOT deleted by
    // the cascade. Cron sweep is the safety net.
    expect(await blobExists(t, legacy)).toBe(true);
  });
});

// Local helper for the FG_091 test block. Returns the inline storageIds
// in a stored article body without taking a dependency on the body-walk
// helper at the test boundary (test-as-documentation).
function extractInlineIdsFromArticleBody(body: unknown): string[] {
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

describe("articles.mutations.remove — inline-image cascade (FR-07, NFR-06)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("deletes 3 inline blobs + 1 cover blob for an article with that media", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const cover = await storeBlob(t, "cover");
    const i1 = await storeBlob(t, "i1");
    const i2 = await storeBlob(t, "i2");
    const i3 = await storeBlob(t, "i3");

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Doomed",
      category: "general",
      body: bodyWithImages(i1, i2, i3),
      status: "draft",
      coverImageStorageId: cover,
    });

    await t.mutation(api.articles.mutations.remove, { ids: [articleId] });

    expect(await blobExists(t, cover)).toBe(false);
    expect(await blobExists(t, i1)).toBe(false);
    expect(await blobExists(t, i2)).toBe(false);
    expect(await blobExists(t, i3)).toBe(false);
  });

  it("skips inline image nodes that have no storageId (legacy external URLs)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Legacy only",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "image", attrs: { src: "https://external/legacy.png" } },
              { type: "image", attrs: { src: "https://external/another.png" } },
            ],
          },
        ],
      },
      status: "draft",
    });

    await t.mutation(api.articles.mutations.remove, { ids: [articleId] });

    const after = await t.run(async (ctx) => ctx.db.get(articleId));
    expect(after).toBeNull();
  });

  it("caps inline deletes at 50 per invocation; remaining 10 left for cron sweep (NFR-06)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const ids: Id<"_storage">[] = [];
    for (let i = 0; i < 60; i++) {
      ids.push(await storeBlob(t, `b-${i}`));
    }

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Many",
      category: "general",
      body: bodyWithImages(...ids),
      status: "draft",
    });

    await t.mutation(api.articles.mutations.remove, { ids: [articleId] });

    let alive = 0;
    for (const id of ids) {
      if (await blobExists(t, id)) alive += 1;
    }
    expect(alive).toBe(10);
  });
});

describe("articles.actions.importMarkdownInlineImages (FR-08)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
    safeFetchMock.mockReset();
  });

  it("external URL → fetched blob stored, body patched with new storageId", async () => {
    const t = makeT();
    const ownerId = await insertAppUserAndSignIn(t);

    safeFetchMock.mockResolvedValueOnce(
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
    );

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Imported",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "https://external.example/hero.png" },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    const result = await t.action(
      internal.articles.actions.importMarkdownInlineImages,
      { articleId, ownerId },
    );

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(0);
    const after = await t.run(async (ctx) => ctx.db.get(articleId));
    const node = (
      after?.body as { content: { content: { attrs: Record<string, unknown> }[] }[] }
    ).content[0].content[0];
    expect(node.attrs.storageId).toBeTypeOf("string");
    expect(node.attrs.src).not.toBe("https://external.example/hero.png");
  });

  it("404/network failure → original src preserved, action does not throw", async () => {
    const t = makeT();
    const ownerId = await insertAppUserAndSignIn(t);

    const { SafeFetchError } = await import("../../content/safe-fetch");
    safeFetchMock.mockRejectedValueOnce(
      new SafeFetchError("http-error", "HTTP 404"),
    );

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Broken",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "https://broken.example/missing.png" },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    const result = await t.action(
      internal.articles.actions.importMarkdownInlineImages,
      { articleId, ownerId },
    );

    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.failures[0]?.reason).toBe("http-error");
    // Pin the per-image identifier surfaced to the user. Mirrors posts test.
    expect(result.failures[0]?.src).toBe("https://broken.example/missing.png");

    const after = await t.run(async (ctx) => ctx.db.get(articleId));
    const node = (
      after?.body as { content: { content: { attrs: Record<string, unknown> }[] }[] }
    ).content[0].content[0];
    expect(node.attrs.src).toBe("https://broken.example/missing.png");
    expect(node.attrs.storageId).toBeUndefined();
  });

  it("idempotent: skips images that already have a storageId", async () => {
    const t = makeT();
    const ownerId = await insertAppUserAndSignIn(t);

    const existing = await storeBlob(t, "already");

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Already imported",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: {
                  storageId: existing,
                  src: "https://convex/already",
                },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    const result = await t.action(
      internal.articles.actions.importMarkdownInlineImages,
      { articleId, ownerId },
    );

    expect(result.imported).toBe(0);
    expect(result.failed).toBe(0);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  // FG_104: defense-in-depth ownership re-check on the internal action.
  // The public wrapper already enforces ownership, but the internal action
  // must also reject mismatched `ownerId` so a future internal caller that
  // bypasses the wrapper cannot silently process another user's article.
  it("rejects mismatched ownerId (FG_104)", async () => {
    const t = makeT();
    const ownerId = await insertAppUserAndSignIn(t);

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Owned",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "https://external.example/hero.png" },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    // A second app user not associated with the article.
    const strangerId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_stranger",
        email: "stranger@example.com",
        onboardingComplete: true,
      }),
    );

    expect(strangerId).not.toBe(ownerId);

    await expect(
      t.action(internal.articles.actions.importMarkdownInlineImages, {
        articleId,
        ownerId: strangerId,
      }),
    ).rejects.toThrow(/Not the owner/);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });
});

// FG_096: the markdown-import action's `_patchInlineImageBody` mutation
// must merge image-node updates into the CURRENT body (re-read inside
// the mutation transaction) rather than overwriting wholesale with the
// stale snapshot the action read seconds earlier. These tests pin the
// merge contract directly by invoking the internal mutation with a
// hand-crafted srcMap, then verifying that user edits intercepted into
// the body between read and patch survive.
describe("articles.internalImages._patchInlineImageBody — concurrent body edits (FG_096)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("user edit between read and patch survives: image src updates apply to surviving image nodes; concurrent paragraph addition is preserved", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    // Create article with a single external-URL image node. This is the
    // body the action would have read in transaction 1.
    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Concurrent edit",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "https://external.example/hero.png" },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    // Action stores a blob during the fetch window. Simulate the
    // resolved entry the action would build from `safeFetchImage`.
    const newStorageId = await storeBlob(t, "merged");

    // Simulate the user editing the body MID-IMPORT: add a fresh
    // paragraph after the image. Performed via a direct ctx.db.patch
    // (proxy for any path that mutates the body — `articles.update`
    // would behave the same).
    await t.run(async (ctx) => {
      await ctx.db.patch(articleId, {
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "image",
                  attrs: { src: "https://external.example/hero.png" },
                },
              ],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "user added during import" }],
            },
          ],
        },
      });
    });

    // Now run the patch with the srcMap derived from the stale
    // (transaction-1) snapshot. The image src is still in the body, so
    // the merge applies; the user's added paragraph must survive.
    await t.mutation(
      internal.articles.internalImages._patchInlineImageBody,
      {
        articleId,
        srcMap: {
          "https://external.example/hero.png": {
            src: "https://convex.example/blob",
            storageId: newStorageId,
          },
        },
      },
    );

    const after = await t.run(async (ctx) => ctx.db.get(articleId));
    expect(after?.body).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src: "https://convex.example/blob",
                storageId: newStorageId,
              },
            },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "user added during import" }],
        },
      ],
    });
  });

  it("image removed mid-import: srcMap entry whose src no longer appears in the body is silently skipped (no re-introduction; blob becomes orphan candidate)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Removed mid-import",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "https://external.example/hero.png" },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    const orphanStorageId = await storeBlob(t, "orphan");

    // User deletes the image node mid-import.
    await t.run(async (ctx) => {
      await ctx.db.patch(articleId, {
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "image gone" }],
            },
          ],
        },
      });
    });

    // Run the patch with a srcMap entry for the deleted image. Must not
    // throw; must not re-introduce the image node.
    await expect(
      t.mutation(internal.articles.internalImages._patchInlineImageBody, {
        articleId,
        srcMap: {
          "https://external.example/hero.png": {
            src: "https://convex.example/blob",
            storageId: orphanStorageId,
          },
        },
      }),
    ).resolves.toBeNull();

    const after = await t.run(async (ctx) => ctx.db.get(articleId));
    expect(after?.body).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "image gone" }],
        },
      ],
    });

    // Ownership is NOT claimed for the orphan storageId — the blob never
    // landed in the body, so cron sweep is the safety net.
    const ownership = await t.run(async (ctx) =>
      ctx.db
        .query("inlineImageOwnership")
        .withIndex("by_storageId", (q) =>
          q.eq("storageId", orphanStorageId),
        )
        .unique(),
    );
    expect(ownership).toBeNull();
  });

  it("image added mid-import (src not in srcMap): pass-through unchanged", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Added mid-import",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "https://external.example/hero.png" },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    const heroStorageId = await storeBlob(t, "hero");

    // User adds a second image node DURING the fetch window — its src
    // is not in the action's srcMap (the action never saw it).
    await t.run(async (ctx) => {
      await ctx.db.patch(articleId, {
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "image",
                  attrs: { src: "https://external.example/hero.png" },
                },
                {
                  type: "image",
                  attrs: { src: "https://external.example/added-later.png" },
                },
              ],
            },
          ],
        },
      });
    });

    await t.mutation(
      internal.articles.internalImages._patchInlineImageBody,
      {
        articleId,
        srcMap: {
          "https://external.example/hero.png": {
            src: "https://convex.example/blob",
            storageId: heroStorageId,
          },
        },
      },
    );

    const after = await t.run(async (ctx) => ctx.db.get(articleId));
    expect(after?.body).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src: "https://convex.example/blob",
                storageId: heroStorageId,
              },
            },
            {
              type: "image",
              attrs: {
                src: "https://external.example/added-later.png",
              },
            },
          ],
        },
      ],
    });
  });
});

describe("articles.inlineImages.importArticleMarkdownInlineImages (FR-08, FR-12)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
    safeFetchMock.mockReset();
  });

  it("authed owner: action runs and returns the inner result shape", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    safeFetchMock.mockResolvedValueOnce(
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
        type: "image/png",
      }),
    );

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Owner Imports",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "https://external.example/owner.png" },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    const result = await t.action(
      api.articles.inlineImages.importArticleMarkdownInlineImages,
      { articleId },
    );

    expect(result).toEqual({
      imported: 1,
      failed: 0,
      failures: [],
    });
  });

  it("authed non-owner: rejects with 'Not authorized' before any side effect", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t, "auth_owner_a", "owner-a@example.com");
    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Other Owner",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_intruder_a",
        email: "intruder-a@example.com",
        onboardingComplete: true,
      }),
    );
    authState.currentAuthUser = { _id: "auth_intruder_a" };

    await expect(
      t.action(api.articles.inlineImages.importArticleMarkdownInlineImages, {
        articleId,
      }),
    ).rejects.toThrow(/not authorized/i);

    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it("unauthed: rejects with 'Not authenticated'", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t, "auth_owner_b", "owner-b@example.com");
    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Unauthed Probe",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    authState.currentAuthUser = null;

    await expect(
      t.action(api.articles.inlineImages.importArticleMarkdownInlineImages, {
        articleId,
      }),
    ).rejects.toThrow(/not authenticated/i);

    expect(safeFetchMock).not.toHaveBeenCalled();
  });
});
