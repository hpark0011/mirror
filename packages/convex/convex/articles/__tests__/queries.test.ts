/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported.
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

async function setupOwnerAndSignIn(t: ReturnType<typeof makeT>) {
  const authId = "auth_articles_query";
  const appUserId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: "owner@example.com",
      username: "owner",
      onboardingComplete: true,
    }),
  );
  authState.currentAuthUser = { _id: authId };
  return { authId, appUserId };
}

async function storeBlob(t: ReturnType<typeof makeT>, contents = "x") {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([contents])));
}

describe("articles.queries.getBySlug — inline image src rewrite (FR-05)", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("rewrites image node `src` to a Convex-served URL when storageId is set", async () => {
    const t = makeT();
    await setupOwnerAndSignIn(t);
    const storageId = await storeBlob(t, "img");

    const articleId = await t.mutation(api.articles.mutations.create, {
      title: "With image",
      slug: "with-image",
      category: "general",
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
    expect(articleId).toBeDefined();

    const result = await t.query(api.articles.queries.getBySlug, {
      username: "owner",
      slug: "with-image",
    });
    const node = (
      result?.body as {
        content: { content: { attrs: Record<string, unknown> }[] }[];
      }
    ).content[0].content[0];
    expect(node.attrs.storageId).toBe(storageId);
    // src must have been rewritten — it must NOT be the original placeholder.
    expect(node.attrs.src).not.toBe("stale://placeholder");
    expect(typeof node.attrs.src).toBe("string");
  });

  it("leaves src untouched when storageId is absent (legacy external URL)", async () => {
    const t = makeT();
    await setupOwnerAndSignIn(t);

    await t.mutation(api.articles.mutations.create, {
      title: "Legacy",
      slug: "legacy",
      category: "general",
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
    });

    const result = await t.query(api.articles.queries.getBySlug, {
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

describe("articles.queries.getByUsernameForConversation — FR-05 articles-only exemption", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("returns body verbatim — no URL rewrite (text extractor skips images)", async () => {
    const t = makeT();
    await setupOwnerAndSignIn(t);

    const storageId: Id<"_storage"> = await storeBlob(t, "for-convo");

    await t.mutation(api.articles.mutations.create, {
      title: "Convo body",
      category: "general",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { storageId, src: "stable://untouched" },
              },
            ],
          },
        ],
      },
      status: "published",
    });

    const list = await t.query(
      api.articles.queries.getByUsernameForConversation,
      { username: "owner" },
    );
    const node = (
      list?.[0]?.body as {
        content: { content: { attrs: Record<string, unknown> }[] }[];
      }
    ).content[0].content[0];
    // src is exactly the placeholder — NOT rewritten.
    expect(node.attrs.src).toBe("stable://untouched");
    expect(node.attrs.storageId).toBe(storageId);
  });
});
