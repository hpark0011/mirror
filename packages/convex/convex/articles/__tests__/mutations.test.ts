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

// Store a real blob in convex-test storage and return a valid _storage Id.
// convex-test validates schema constraints, so fake string ids are rejected.
async function storeBlob(
  t: ReturnType<typeof makeT>,
  contents = "test-cover",
): Promise<Id<"_storage">> {
  return t.run(async (ctx) => ctx.storage.store(new Blob([contents])));
}

describe("articles.mutations — coverImageThumbhash contract", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("create with coverImageThumbhash persists the field on the row", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t);

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

  it("update with clearCoverImage: true clears both coverImageStorageId and coverImageThumbhash", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const storageId = await storeBlob(t, "cover-to-clear");

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
      clearCoverImage: true,
    });

    const after = await t.run(async (ctx) => ctx.db.get(id));
    expect(after?.coverImageStorageId).toBeUndefined();
    expect(after?.coverImageThumbhash).toBeUndefined();
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
        thumbhash: "shouldFail==",
      }),
    ).rejects.toThrow(/no cover image/i);

    // Seed a real coverImageStorageId so the mutation can proceed.
    await t.run(async (ctx) => ctx.db.patch(id, { coverImageStorageId: storageId }));

    await t.mutation(internal.articles.mutations.setCoverImageThumbhash, {
      id,
      thumbhash: "backfilledHash==",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.coverImageThumbhash).toBe("backfilledHash==");
  });
});
