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

// `articles/mutations.ts` calls `authComponent.getAuthUser` via `authMutation`
// in `lib/auth.ts`. Stub the auth client so `convex-test` can drive the
// mutation without a real Better Auth runtime.
const authState = {
  // When non-null, `authComponent.getAuthUser` resolves to this value.
  // Only `_id` is read by `authMutation` -> `getAppUser(ctx, ctx.user._id)`.
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

import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { normalizeConvexTestModules } from "../../__tests__/testUtils";

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexTestModules(rawModules, {
  sourceDir: "articles",
});

function makeT() {
  return convexTest(schema, modules);
}

// Insert an authenticated app user row and set `authState` so the mocked
// `authComponent.getAuthUser` returns a shape that resolves through
// `getAppUser` (which looks up by `authId`).
async function insertAppUserAndSignIn(
  t: ReturnType<typeof makeT>,
  authId = "auth_articles_owner",
  email = "articles-owner@example.com",
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

describe("articles.mutations.create — slug normalization", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("normalizes a malformed client-supplied slug at the boundary", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Foo",
      slug: "foo?",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.slug).toBe("foo");
  });

  it("falls back to the title when no slug arg is supplied", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Hello World!",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.slug).toBe("hello-world");
  });

  it("treats empty-string slug as 'no slug supplied' and falls back to the title (F5)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Hello",
      slug: "",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.slug).toBe("hello");
  });

  it("throws when the supplied slug has no alphanumerics", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    await expect(
      t.mutation(api.articles.mutations.create, {
        title: "ignored", // title is irrelevant — slug arg is non-empty so it's used
        slug: "???",
        category: "general",
        body: { type: "doc", content: [] },
        status: "draft",
      }),
    ).rejects.toThrow(/cannot generate slug/i);
  });
});

describe("articles.mutations.update — slug normalization", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("normalizes a malformed slug at the boundary", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Initial",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    await t.mutation(api.articles.mutations.update, {
      id,
      slug: "Bar?",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.slug).toBe("bar");
  });

  it("treats empty-string slug as a no-op (F5) — does NOT throw", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Initial",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });
    const before = await t.run(async (ctx) => ctx.db.get(id));

    await expect(
      t.mutation(api.articles.mutations.update, {
        id,
        slug: "",
      }),
    ).resolves.toBeNull();

    const after = await t.run(async (ctx) => ctx.db.get(id));
    expect(after?.slug).toBe(before?.slug);
  });

  it("undefined slug leaves slug unchanged (F9 — no uniqueness probe)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Initial",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });
    const before = await t.run(async (ctx) => ctx.db.get(id));

    await t.mutation(api.articles.mutations.update, {
      id,
      title: "New title",
    });

    const after = await t.run(async (ctx) => ctx.db.get(id));
    expect(after?.slug).toBe(before?.slug);
    expect(after?.title).toBe("New title");
  });

  it("round-tripping the existing slug verbatim does NOT throw (F14 — self-match short-circuit)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Roundtrip",
      slug: "roundtrip",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
    });
    const before = await t.run(async (ctx) => ctx.db.get(id));
    expect(before?.slug).toBe("roundtrip");

    await expect(
      t.mutation(api.articles.mutations.update, {
        id,
        slug: "roundtrip",
      }),
    ).resolves.toBeNull();

    const after = await t.run(async (ctx) => ctx.db.get(id));
    expect(after?.slug).toBe("roundtrip");
  });
});

type CoverBlobKind = "image" | "video" | "poster";

async function storeBlob(
  t: ReturnType<typeof makeT>,
  contents = "test-cover",
): Promise<Id<"_storage">> {
  return t.run(async (ctx) => ctx.storage.store(new Blob([contents])));
}

async function findCoverOwnership(
  t: ReturnType<typeof makeT>,
  storageId: Id<"_storage">,
) {
  return t.run(async (ctx) =>
    ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique(),
  );
}

describe("articles.mutations — coverImageThumbhash contract", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("create with coverImageThumbhash persists the field on the row", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t);
    await seedCoverOwnership(t, storageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Cover Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: storageId,
      coverImageThumbhash: "abc123thumbhash==",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageThumbhash).toBe("abc123thumbhash==");
  });

  it("update with a new coverImageStorageId and coverImageThumbhash persists both", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const oldStorageId = await storeBlob(t, "old-cover");
    const newStorageId = await storeBlob(t, "new-cover");
    await seedCoverOwnership(t, oldStorageId, "auth_articles_owner");
    await seedCoverOwnership(t, newStorageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Cover Update Both",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: oldStorageId,
      coverImageThumbhash: "oldhash==",
    });

    await t.mutation(api.articles.mutations.update, {
      id,
      coverImageStorageId: newStorageId,
      coverImageThumbhash: "newhash==",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageStorageId).toBe(newStorageId);
    expect(row?.coverImageThumbhash).toBe("newhash==");
  });

  it("update with a new coverImageStorageId and NO coverImageThumbhash clears the hash (coupling rule)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const oldStorageId = await storeBlob(t, "old-cover");
    const newStorageId = await storeBlob(t, "new-cover");
    await seedCoverOwnership(t, oldStorageId, "auth_articles_owner");
    await seedCoverOwnership(t, newStorageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Coupling Rule Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: oldStorageId,
      coverImageThumbhash: "staleHash==",
    });

    // Replace the cover without supplying a new hash — the stale hash must be cleared.
    await t.mutation(api.articles.mutations.update, {
      id,
      coverImageStorageId: newStorageId,
      // coverImageThumbhash intentionally omitted
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageStorageId).toBe(newStorageId);
    // Load-bearing coupling rule: stale hash from the old cover must not survive.
    expect(row?.coverImageThumbhash).toBeUndefined();
  });

  it("update with clearCover: true clears both coverImageStorageId and coverImageThumbhash", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "cover-to-clear");
    await seedCoverOwnership(t, storageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Clear Cover Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: storageId,
      coverImageThumbhash: "someHash==",
    });

    const before = await t.run(async (ctx) => ctx.db.get(id));
    expect(before?.coverImageThumbhash).toBe("someHash==");

    await t.mutation(api.articles.mutations.update, {
      id,
      clearCover: true,
    });

    const after = await t.run(async (ctx) => ctx.db.get(id));
    expect(after?.coverImageStorageId).toBeUndefined();
    expect(after?.coverImageThumbhash).toBeUndefined();
    expect(await t.run(async (ctx) => ctx.db.system.get(storageId))).toBeNull();
    expect(await findCoverOwnership(t, storageId)).toBeNull();
  });

  it("setCoverImageThumbhash patches the thumbhash; throws if article has no coverImageStorageId", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "cover-for-backfill");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Backfill Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      // No coverImageStorageId — should cause setCoverImageThumbhash to throw.
    });

    // Throws when no coverImageStorageId is set on the article.
    await expect(
      t.mutation(internal.articles.mutations.setCoverImageThumbhash, {
        id,
        expectedStorageId: storageId,
        thumbhash: "shouldFail==",
      }),
    ).rejects.toThrow(/no cover image/i);

    // Seed a real coverImageStorageId so the mutation can proceed.
    await t.run(async (ctx) =>
      ctx.db.patch(id, { coverImageStorageId: storageId }),
    );

    await t.mutation(internal.articles.mutations.setCoverImageThumbhash, {
      id,
      expectedStorageId: storageId,
      thumbhash: "backfilledHash==",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageThumbhash).toBe("backfilledHash==");
  });

  it("update with the same coverImageStorageId and a NEW coverImageThumbhash patches only the hash (Branch 3)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "cover-branch3");
    await seedCoverOwnership(t, storageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Branch 3 Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: storageId,
      coverImageThumbhash: "originalHash==",
    });

    await t.mutation(api.articles.mutations.update, {
      id,
      coverImageStorageId: storageId, // SAME storageId
      coverImageThumbhash: "freshlyComputedHash==", // NEW hash
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageStorageId).toBe(storageId);
    expect(row?.coverImageThumbhash).toBe("freshlyComputedHash==");
  });

  it("update with the same coverImageStorageId and same/no coverImageThumbhash is a no-op (Branch 4)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "cover-branch4");
    await seedCoverOwnership(t, storageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Branch 4 Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: storageId,
      coverImageThumbhash: "preservedHash==",
    });

    // Round-trip the existing storageId, no thumbhash arg supplied.
    // Per the coupling rule, this is a no-op for both fields.
    await t.mutation(api.articles.mutations.update, {
      id,
      coverImageStorageId: storageId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageStorageId).toBe(storageId);
    expect(row?.coverImageThumbhash).toBe("preservedHash==");
  });

  it("update rejects an oversized coverImageThumbhash", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "cover-len-cap");
    await seedCoverOwnership(t, storageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Length Cap Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: storageId,
    });

    // 300 base64-shaped chars — well over the 256-char cap. The character
    // class is intentionally valid base64 so this asserts the LENGTH path,
    // not the format path.
    const oversized = "A".repeat(300);
    await expect(
      t.mutation(api.articles.mutations.update, {
        id,
        coverImageThumbhash: oversized,
      }),
    ).rejects.toThrow(/coverImageThumbhash/);
  });

  it("update rejects a non-base64 coverImageThumbhash", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "cover-fmt");
    await seedCoverOwnership(t, storageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Format Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: storageId,
    });

    await expect(
      t.mutation(api.articles.mutations.update, {
        id,
        coverImageThumbhash: "!!!not-base64!!!",
      }),
    ).rejects.toThrow(/base64/i);
  });

  it("setCoverImageThumbhash refuses to patch when expectedStorageId no longer matches the article", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const originalStorageId = await storeBlob(t, "cover-original");
    const replacementStorageId = await storeBlob(t, "cover-replacement");
    await seedCoverOwnership(t, originalStorageId, "auth_articles_owner");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Race Guard Test",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: originalStorageId,
      coverImageThumbhash: "hashA==",
    });

    // Simulate the user replacing the cover after the backfill resolved a URL
    // for `originalStorageId` but before it patched the new hash.
    await t.run(async (ctx) =>
      ctx.db.patch(id, { coverImageStorageId: replacementStorageId }),
    );

    await expect(
      t.mutation(internal.articles.mutations.setCoverImageThumbhash, {
        id,
        expectedStorageId: originalStorageId, // stale — points at the replaced blob
        thumbhash: "hashB==",
      }),
    ).rejects.toThrow(/cover image changed/i);

    // The article's hash from before the race must NOT be overwritten.
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageStorageId).toBe(replacementStorageId);
    expect(row?.coverImageThumbhash).toBe("hashA==");
  });
});

// PLAN_010: cover-video flow — create, update (image↔video swap, video
// replace), remove-with-video, and mutual-exclusion guards.
//
// IMPORTANT: convex-test 0.0.51's `ctx.storage.store(blob)` does NOT
// preserve Blob.type in `_storage.contentType`. Claim validation tests can
// exercise the missing-MIME rejection path; flow tests seed ownership
// directly so they can focus on create/update/delete behavior.
async function storeBlobBytes(
  t: ReturnType<typeof makeT>,
  bytes = 64,
): Promise<Id<"_storage">> {
  return t.run(async (ctx) =>
    ctx.storage.store(new Blob([new Uint8Array(bytes)])),
  );
}

async function seedCoverOwnership(
  t: ReturnType<typeof makeT>,
  storageId: Id<"_storage">,
  authId: string,
  kind: CoverBlobKind = "image",
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
      kind,
    });
  });
}

async function seedLegacyCoverOwnership(
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
    });
  });
}

describe("articles.mutations — cover blob ownership policy", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  const ownerAuthId = "auth_articles_owner";

  it("generateArticleCoverVideoUploadUrls returns video and poster URLs", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const urls = await t.mutation(
      api.articles.mutations.generateArticleCoverVideoUploadUrls,
      {},
    );

    expect(urls.videoUrl).toMatch(/\/api\/storage\/upload/);
    expect(urls.posterUrl).toMatch(/\/api\/storage\/upload/);
    expect(urls.videoUrl).not.toBe(urls.posterUrl);
  });

  it("claimCoverImageOwnership rejects missing MIME and deletes the blob", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "mime-less-image");

    await expect(
      t.action(api.articles.mutations.claimCoverImageOwnership, {
        storageId,
      }),
    ).rejects.toThrow(/cover image must be one of/i);

    expect(await t.run(async (ctx) => ctx.db.system.get(storageId))).toBeNull();
    expect(await findCoverOwnership(t, storageId)).toBeNull();
  });

  it("claimCoverVideoPosterOwnership rejects missing MIME", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "mime-less-poster");

    await expect(
      t.action(api.articles.mutations.claimCoverVideoPosterOwnership, {
        storageId,
      }),
    ).rejects.toThrow(/cover video poster must be one of/i);

    expect(await t.run(async (ctx) => ctx.db.system.get(storageId))).toBeNull();
    expect(await findCoverOwnership(t, storageId)).toBeNull();
  });

  it("create rejects a video-claimed blob in the cover image slot", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const videoId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");

    await expect(
      t.mutation(api.articles.mutations.create, {
        title: "Wrong Kind",
        category: "general",
        body: { type: "doc", content: [] },
        status: "draft",
        coverImageStorageId: videoId,
      }),
    ).rejects.toThrow(/cannot be used as image/i);
  });

  it("legacy kindless ownership rows are accepted only as image claims", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const legacyImageId = await storeBlob(t, "legacy-image");
    await seedLegacyCoverOwnership(t, legacyImageId, ownerAuthId);
    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "Legacy Image",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: legacyImageId,
    });
    expect((await t.run(async (ctx) => ctx.db.get(articleId)))?._id).toBe(
      articleId,
    );

    const legacyVideoId = await storeBlobBytes(t);
    const posterId = await storeBlob(t, "legacy-poster");
    await seedLegacyCoverOwnership(t, legacyVideoId, ownerAuthId);
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");

    await expect(
      t.mutation(api.articles.mutations.create, {
        title: "Legacy Video",
        category: "general",
        body: { type: "doc", content: [] },
        status: "draft",
        coverVideoStorageId: legacyVideoId,
        coverVideoPosterStorageId: posterId,
      }),
    ).rejects.toThrow(/cannot be used as video/i);
  });

  it("backfillCoverImageOwnershipKind sets legacy rows to image", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "legacy-backfill");
    await seedLegacyCoverOwnership(t, storageId, ownerAuthId);

    const result = await t.mutation(
      internal.migrations.articles.backfillCoverImageOwnershipKind,
      {
        paginationOpts: { numItems: 10, cursor: null },
      },
    );

    expect(result.patched).toBe(1);
    expect((await findCoverOwnership(t, storageId))?.kind).toBe("image");
  });
});

describe("articles.mutations — cover video flow (PLAN_010)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  const ownerAuthId = "auth_articles_owner";

  it("create with video + poster persists both fields", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const videoId = await storeBlobBytes(t);
    const posterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");

    const id = await t.mutation(api.articles.mutations.create, {
      title: "Has Video",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: posterId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverVideoStorageId).toBe(videoId);
    expect(row?.coverVideoPosterStorageId).toBe(posterId);
    expect(row?.coverImageStorageId).toBeUndefined();
  });

  it("create with video but no poster is rejected", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const videoId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");

    await expect(
      t.mutation(api.articles.mutations.create, {
        title: "No Poster",
        category: "general",
        body: { type: "doc", content: [] },
        status: "draft",
        coverVideoStorageId: videoId,
      }),
    ).rejects.toThrow(/cover video requires a sibling poster/i);
  });

  it("create with both image and video covers is rejected", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const imageId = await storeBlob(t, "image-cover");
    const videoId = await storeBlobBytes(t);
    const posterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, imageId, ownerAuthId);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");

    await expect(
      t.mutation(api.articles.mutations.create, {
        title: "Both Covers",
        category: "general",
        body: { type: "doc", content: [] },
        status: "draft",
        coverImageStorageId: imageId,
        coverVideoStorageId: videoId,
        coverVideoPosterStorageId: posterId,
      }),
    ).rejects.toThrow(/mutually exclusive/i);
  });

  it("update image → video clears the image fields and deletes the old image blob", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const imageId = await storeBlob(t, "old-image");
    await seedCoverOwnership(t, imageId, ownerAuthId);
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Swap",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverImageStorageId: imageId,
      coverImageThumbhash: "hash==",
    });

    const videoId = await storeBlobBytes(t);
    const posterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");

    await t.mutation(api.articles.mutations.update, {
      id,
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: posterId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageStorageId).toBeUndefined();
    expect(row?.coverImageThumbhash).toBeUndefined();
    expect(row?.coverVideoStorageId).toBe(videoId);
    expect(row?.coverVideoPosterStorageId).toBe(posterId);

    const oldMeta = await t.run(async (ctx) => ctx.db.system.get(imageId));
    expect(oldMeta).toBeNull();
    expect(await findCoverOwnership(t, imageId)).toBeNull();
  });

  it("update video → image clears video + poster and deletes both old blobs", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const videoId = await storeBlobBytes(t);
    const posterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Swap-back",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: posterId,
    });

    const imageId = await storeBlob(t, "new-image");
    await seedCoverOwnership(t, imageId, ownerAuthId);

    await t.mutation(api.articles.mutations.update, {
      id,
      coverImageStorageId: imageId,
      coverImageThumbhash: "imghash==",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverVideoStorageId).toBeUndefined();
    expect(row?.coverVideoPosterStorageId).toBeUndefined();
    expect(row?.coverImageStorageId).toBe(imageId);

    const oldVideoMeta = await t.run(async (ctx) => ctx.db.system.get(videoId));
    const oldPosterMeta = await t.run(async (ctx) =>
      ctx.db.system.get(posterId),
    );
    expect(oldVideoMeta).toBeNull();
    expect(oldPosterMeta).toBeNull();
    expect(await findCoverOwnership(t, videoId)).toBeNull();
    expect(await findCoverOwnership(t, posterId)).toBeNull();
  });

  it("update video → new video replaces the previous video + poster blobs", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const oldVideoId = await storeBlobBytes(t);
    const oldPosterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, oldVideoId, ownerAuthId, "video");
    await seedCoverOwnership(t, oldPosterId, ownerAuthId, "poster");
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Video Replace",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverVideoStorageId: oldVideoId,
      coverVideoPosterStorageId: oldPosterId,
    });

    const newVideoId = await storeBlobBytes(t, 128);
    const newPosterId = await storeBlobBytes(t, 64);
    await seedCoverOwnership(t, newVideoId, ownerAuthId, "video");
    await seedCoverOwnership(t, newPosterId, ownerAuthId, "poster");

    await t.mutation(api.articles.mutations.update, {
      id,
      coverVideoStorageId: newVideoId,
      coverVideoPosterStorageId: newPosterId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverVideoStorageId).toBe(newVideoId);
    expect(row?.coverVideoPosterStorageId).toBe(newPosterId);

    const oldVideoMeta = await t.run(async (ctx) =>
      ctx.db.system.get(oldVideoId),
    );
    const oldPosterMeta = await t.run(async (ctx) =>
      ctx.db.system.get(oldPosterId),
    );
    expect(oldVideoMeta).toBeNull();
    expect(oldPosterMeta).toBeNull();
    expect(await findCoverOwnership(t, oldVideoId)).toBeNull();
    expect(await findCoverOwnership(t, oldPosterId)).toBeNull();
  });

  it("update with the same video and a new poster replaces only the poster blob", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const videoId = await storeBlobBytes(t);
    const oldPosterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, oldPosterId, ownerAuthId, "poster");
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Poster Replace",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: oldPosterId,
    });

    const newPosterId = await storeBlobBytes(t, 96);
    await seedCoverOwnership(t, newPosterId, ownerAuthId, "poster");

    await t.mutation(api.articles.mutations.update, {
      id,
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: newPosterId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverVideoStorageId).toBe(videoId);
    expect(row?.coverVideoPosterStorageId).toBe(newPosterId);

    expect(
      await t.run(async (ctx) => ctx.db.system.get(videoId)),
    ).not.toBeNull();
    expect(await findCoverOwnership(t, videoId)).not.toBeNull();
    expect(
      await t.run(async (ctx) => ctx.db.system.get(oldPosterId)),
    ).toBeNull();
    expect(await findCoverOwnership(t, oldPosterId)).toBeNull();
    expect(
      await t.run(async (ctx) => ctx.db.system.get(newPosterId)),
    ).not.toBeNull();
    expect(await findCoverOwnership(t, newPosterId)).not.toBeNull();
  });

  it("update with the same video and poster ids is a round-trip no-op", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const videoId = await storeBlobBytes(t);
    const posterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Video Round Trip",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: posterId,
    });

    await t.mutation(api.articles.mutations.update, {
      id,
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: posterId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverVideoStorageId).toBe(videoId);
    expect(row?.coverVideoPosterStorageId).toBe(posterId);
    expect(
      await t.run(async (ctx) => ctx.db.system.get(videoId)),
    ).not.toBeNull();
    expect(
      await t.run(async (ctx) => ctx.db.system.get(posterId)),
    ).not.toBeNull();
  });

  it("clearCover wipes every cover field and deletes every cover blob", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const videoId = await storeBlobBytes(t);
    const posterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Clear Cover",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: posterId,
    });

    await t.mutation(api.articles.mutations.update, {
      id,
      clearCover: true,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageStorageId).toBeUndefined();
    expect(row?.coverImageThumbhash).toBeUndefined();
    expect(row?.coverVideoStorageId).toBeUndefined();
    expect(row?.coverVideoPosterStorageId).toBeUndefined();

    expect(await t.run(async (ctx) => ctx.db.system.get(videoId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(posterId))).toBeNull();
    expect(await findCoverOwnership(t, videoId)).toBeNull();
    expect(await findCoverOwnership(t, posterId)).toBeNull();
  });

  it("remove cascades deletes for both video + poster blobs", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const videoId = await storeBlobBytes(t);
    const posterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");
    const id = await t.mutation(api.articles.mutations.create, {
      title: "Remove Video",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverVideoStorageId: videoId,
      coverVideoPosterStorageId: posterId,
    });

    await t.mutation(api.articles.mutations.remove, { ids: [id] });

    expect(await t.run(async (ctx) => ctx.db.system.get(videoId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(posterId))).toBeNull();
    expect(await findCoverOwnership(t, videoId)).toBeNull();
    expect(await findCoverOwnership(t, posterId)).toBeNull();
  });

  it("deleteOrphanCoverVideo deletes unreferenced blobs and preserves referenced ones", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const orphanVideoId = await storeBlobBytes(t);
    const orphanPosterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, orphanVideoId, ownerAuthId, "video");
    await seedCoverOwnership(t, orphanPosterId, ownerAuthId, "poster");

    // Article references a DIFFERENT video — the orphan-delete must
    // skip the referenced one and only clean up the orphans.
    const refVideoId = await storeBlobBytes(t);
    const refPosterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, refVideoId, ownerAuthId, "video");
    await seedCoverOwnership(t, refPosterId, ownerAuthId, "poster");
    await t.mutation(api.articles.mutations.create, {
      title: "Owner",
      category: "general",
      body: { type: "doc", content: [] },
      status: "draft",
      coverVideoStorageId: refVideoId,
      coverVideoPosterStorageId: refPosterId,
    });

    await t.mutation(api.articles.mutations.deleteOrphanCoverVideo, {
      videoStorageId: orphanVideoId,
      posterStorageId: orphanPosterId,
    });

    expect(
      await t.run(async (ctx) => ctx.db.system.get(orphanVideoId)),
    ).toBeNull();
    expect(
      await t.run(async (ctx) => ctx.db.system.get(orphanPosterId)),
    ).toBeNull();
    expect(await findCoverOwnership(t, orphanVideoId)).toBeNull();
    expect(await findCoverOwnership(t, orphanPosterId)).toBeNull();

    // And referenced blobs survive a parallel call.
    await t.mutation(api.articles.mutations.deleteOrphanCoverVideo, {
      videoStorageId: refVideoId,
      posterStorageId: refPosterId,
    });
    expect(
      await t.run(async (ctx) => ctx.db.system.get(refVideoId)),
    ).not.toBeNull();
    expect(
      await t.run(async (ctx) => ctx.db.system.get(refPosterId)),
    ).not.toBeNull();
    expect(await findCoverOwnership(t, refVideoId)).not.toBeNull();
    expect(await findCoverOwnership(t, refPosterId)).not.toBeNull();
  });

  it("deleteOrphanCoverVideo refuses to delete another user's pending blobs", async () => {
    const t = makeT();
    const ownerAuthId = "auth_video_owner";
    const attackerAuthId = "auth_video_attacker";
    await insertAppUserAndSignIn(t, ownerAuthId, "video-owner@example.com");

    const videoId = await storeBlobBytes(t);
    const posterId = await storeBlobBytes(t);
    await seedCoverOwnership(t, videoId, ownerAuthId, "video");
    await seedCoverOwnership(t, posterId, ownerAuthId, "poster");

    await insertAppUserAndSignIn(
      t,
      attackerAuthId,
      "video-attacker@example.com",
    );

    await t.mutation(api.articles.mutations.deleteOrphanCoverVideo, {
      videoStorageId: videoId,
      posterStorageId: posterId,
    });

    expect(
      await t.run(async (ctx) => ctx.db.system.get(videoId)),
    ).not.toBeNull();
    expect(
      await t.run(async (ctx) => ctx.db.system.get(posterId)),
    ).not.toBeNull();
  });

  it("deleteOrphanCoverImage deletes an unreferenced blob and its ownership row", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const storageId = await storeBlob(t, "orphan-image");
    await seedCoverOwnership(t, storageId, ownerAuthId);

    await t.mutation(api.articles.mutations.deleteOrphanCoverImage, {
      storageId,
    });

    expect(
      await t.run(async (ctx) => ctx.db.system.get(storageId)),
    ).toBeNull();
    expect(await findCoverOwnership(t, storageId)).toBeNull();
  });

  it("deleteOrphanCoverImage refuses to delete another user's pending blob", async () => {
    const t = makeT();
    const ownerAuthId = "auth_image_owner";
    const attackerAuthId = "auth_image_attacker";
    await insertAppUserAndSignIn(t, ownerAuthId, "image-owner@example.com");

    const storageId = await storeBlob(t, "owner-image");
    await seedCoverOwnership(t, storageId, ownerAuthId);

    await insertAppUserAndSignIn(
      t,
      attackerAuthId,
      "image-attacker@example.com",
    );

    await t.mutation(api.articles.mutations.deleteOrphanCoverImage, {
      storageId,
    });

    expect(
      await t.run(async (ctx) => ctx.db.system.get(storageId)),
    ).not.toBeNull();
  });
});
