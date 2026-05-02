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

const safeFetchMock = vi.fn();
vi.mock("../../content/safe-fetch", () => {
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

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Legacy only",
      category: "Creativity",
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

describe("posts.actions.importMarkdownInlineImages (FR-08)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
    safeFetchMock.mockReset();
  });

  it("external URL → fetched blob stored, body patched", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    safeFetchMock.mockResolvedValueOnce(
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
    );

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Imported",
      category: "Creativity",
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
      internal.posts.actions.importMarkdownInlineImages,
      { postId },
    );

    expect(result.imported).toBe(1);
    const after = await t.run(async (ctx) => ctx.db.get(postId));
    const node = (
      after?.body as { content: { content: { attrs: Record<string, unknown> }[] }[] }
    ).content[0].content[0];
    expect(node.attrs.storageId).toBeTypeOf("string");
    expect(node.attrs.src).not.toBe("https://external.example/hero.png");
  });

  it("404/network failure → original src preserved", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const { SafeFetchError } = await import("../../content/safe-fetch");
    safeFetchMock.mockRejectedValueOnce(
      new SafeFetchError("http-error", "HTTP 404"),
    );

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Broken",
      category: "Creativity",
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
      internal.posts.actions.importMarkdownInlineImages,
      { postId },
    );

    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.failures[0]?.reason).toBe("http-error");
    expect(result.failures[0]?.src).toBe("https://broken.example/missing.png");

    const after = await t.run(async (ctx) => ctx.db.get(postId));
    const node = (
      after?.body as { content: { content: { attrs: Record<string, unknown> }[] }[] }
    ).content[0].content[0];
    expect(node.attrs.src).toBe("https://broken.example/missing.png");
    expect(node.attrs.storageId).toBeUndefined();
  });

  it("idempotent: skips images that already have a storageId", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const existing = await storeBlob(t, "already");

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Already",
      category: "Creativity",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { storageId: existing, src: "https://convex/x" },
              },
            ],
          },
        ],
      },
      status: "draft",
    });

    const result = await t.action(
      internal.posts.actions.importMarkdownInlineImages,
      { postId },
    );

    expect(result.imported).toBe(0);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });
});

describe("posts.inlineImages.importPostMarkdownInlineImages (FR-08, FR-12)", () => {
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

    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Owner Imports",
      category: "Creativity",
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
      api.posts.inlineImages.importPostMarkdownInlineImages,
      { postId },
    );

    expect(result).toEqual({
      imported: 1,
      failed: 0,
      failures: [],
    });
  });

  it("authed non-owner: rejects with 'Not authorized' before any side effect", async () => {
    const t = makeT();
    // Owner creates the post.
    await insertAppUserAndSignIn(t, "auth_owner_a", "owner-a@example.com");
    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Other Owner",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    // A different authed user attempts the import.
    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_intruder_a",
        email: "intruder-a@example.com",
        onboardingComplete: true,
      }),
    );
    authState.currentAuthUser = { _id: "auth_intruder_a" };

    await expect(
      t.action(api.posts.inlineImages.importPostMarkdownInlineImages, {
        postId,
      }),
    ).rejects.toThrow(/not authorized/i);

    // Trust-boundary contract: no fetch was attempted.
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it("unauthed: rejects with 'Not authenticated'", async () => {
    const t = makeT();
    // Insert a post under some owner so the postId is real.
    await insertAppUserAndSignIn(t, "auth_owner_b", "owner-b@example.com");
    const postId = await t.mutation(api.posts.mutations.create, {
      title: "Unauthed Probe",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    // Drop the session.
    authState.currentAuthUser = null;

    await expect(
      t.action(api.posts.inlineImages.importPostMarkdownInlineImages, {
        postId,
      }),
    ).rejects.toThrow(/not authenticated/i);

    expect(safeFetchMock).not.toHaveBeenCalled();
  });
});
