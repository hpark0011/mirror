/// <reference types="vite/client" />

// Set required env vars BEFORE any Convex module is imported. `convex/env.ts`
// validates these at module-load time and throws otherwise.
process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";

// See `betaAllowlist/__tests__/allowlist.test.ts` for the rationale behind
// rewriting the import.meta.glob keys: convex-test needs a single uniform
// prefix rooted at the `_generated/` entry, regardless of where the test
// file lives in the source tree.
function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../content/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../content/" + k.slice(3);
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

// Minimal user fixture — only the fields required by the schema's
// `usersTable`. The backfill mutations never read user fields, only the
// Id reference on each post/article.
async function insertUser(
  t: ReturnType<typeof makeT>,
  authId: string,
): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: `${authId}@example.com`,
      onboardingComplete: true,
    }),
  );
}

// Insert a post bypassing the public mutation — we deliberately seed
// malformed slugs that the public mutation would reject.
async function insertPost(
  t: ReturnType<typeof makeT>,
  fields: { userId: Id<"users">; slug: string; title: string },
): Promise<Id<"posts">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("posts", {
      userId: fields.userId,
      slug: fields.slug,
      title: fields.title,
      body: {},
      createdAt: Date.now(),
      status: "published",
      category: "general",
    }),
  );
}

async function getPost(t: ReturnType<typeof makeT>, id: Id<"posts">) {
  return await t.run(async (ctx) => ctx.db.get(id));
}

describe("backfillPostSlugs", () => {
  it("idempotent skip — clean slug is left untouched and produces no rewrite entry", async () => {
    const t = makeT();
    const userId = await insertUser(t, "user-clean");
    const id = await insertPost(t, {
      userId,
      slug: "hello-world",
      title: "Hello World",
    });

    const result = await t.mutation(
      internal.content.backfill.backfillPostSlugs,
      {},
    );

    expect(result.scanned).toBe(1);
    expect(result.fixed).toBe(0);
    expect(result.rewrites).toEqual([]);

    const after = await getPost(t, id);
    expect(after?.slug).toBe("hello-world");
  });

  it("basic rewrite — `hello?` is normalized to `hello` and emits a rewrite entry", async () => {
    const t = makeT();
    const userId = await insertUser(t, "user-basic");
    const id = await insertPost(t, {
      userId,
      slug: "hello?",
      title: "Hello",
    });

    const result = await t.mutation(
      internal.content.backfill.backfillPostSlugs,
      {},
    );

    expect(result.fixed).toBe(1);
    expect(result.rewrites).toEqual([
      { id, from: "hello?", to: "hello" },
    ]);

    const after = await getPost(t, id);
    expect(after?.slug).toBe("hello");
  });

  it("cross-user isolation — collision check is scoped to the same user, no suffix added", async () => {
    const t = makeT();
    const userA = await insertUser(t, "user-a");
    const userB = await insertUser(t, "user-b");
    // user A: clean slug `hello`. user B: malformed slug that normalizes to `hello`.
    const cleanId = await insertPost(t, {
      userId: userA,
      slug: "hello",
      title: "Hello",
    });
    const malformedId = await insertPost(t, {
      userId: userB,
      slug: "hello??",
      title: "Hello",
    });

    await t.mutation(internal.content.backfill.backfillPostSlugs, {});

    const cleanAfter = await getPost(t, cleanId);
    const malformedAfter = await getPost(t, malformedId);
    // user A's row is untouched.
    expect(cleanAfter?.slug).toBe("hello");
    // user B's row got the bare `hello` — no `-2` suffix because the
    // collision is across user boundaries.
    expect(malformedAfter?.slug).toBe("hello");
  });

  it("same-user collision — malformed row gets suffixed when a clean sibling already owns the target slug", async () => {
    const t = makeT();
    const userId = await insertUser(t, "user-collide");
    const cleanId = await insertPost(t, {
      userId,
      slug: "hello",
      title: "Hello",
    });
    const malformedId = await insertPost(t, {
      userId,
      slug: "hello??",
      title: "Hello",
    });

    await t.mutation(internal.content.backfill.backfillPostSlugs, {});

    const cleanAfter = await getPost(t, cleanId);
    const malformedAfter = await getPost(t, malformedId);
    expect(cleanAfter?.slug).toBe("hello");
    expect(malformedAfter?.slug).toBe("hello-2");
  });

  it("two-malformed-collide — read-your-writes within the transaction means second row sees the first row's new slug", async () => {
    const t = makeT();
    const userId = await insertUser(t, "user-pair");
    const firstId = await insertPost(t, {
      userId,
      slug: "hello?",
      title: "Hello",
    });
    const secondId = await insertPost(t, {
      userId,
      slug: "hello??",
      title: "Hello",
    });

    await t.mutation(internal.content.backfill.backfillPostSlugs, {});

    const firstAfter = await getPost(t, firstId);
    const secondAfter = await getPost(t, secondId);
    // Insertion order is preserved by ascending `_creationTime`; the first
    // malformed row claims `hello`, the second falls through to `hello-2`.
    expect(firstAfter?.slug).toBe("hello");
    expect(secondAfter?.slug).toBe("hello-2");
  });

  it("empty-title-recoverable — empty title falls back to normalizing the slug itself", async () => {
    const t = makeT();
    const userId = await insertUser(t, "user-empty-title");
    const id = await insertPost(t, {
      userId,
      slug: "foo?",
      title: "",
    });

    const result = await t.mutation(
      internal.content.backfill.backfillPostSlugs,
      {},
    );

    expect(result.fixed).toBe(1);
    const after = await getPost(t, id);
    expect(after?.slug).toBe("foo");
  });

  it("empty-title-unrecoverable — both inputs normalize to empty, row is skipped and surfaced as <UNFIXABLE>", async () => {
    const t = makeT();
    const userId = await insertUser(t, "user-unfixable");
    const id = await insertPost(t, {
      userId,
      slug: "???",
      title: "",
    });

    const result = await t.mutation(
      internal.content.backfill.backfillPostSlugs,
      {},
    );

    expect(result.fixed).toBe(0);
    expect(result.rewrites).toEqual([
      { id, from: "???", to: "<UNFIXABLE>" },
    ]);

    // Row was NOT patched.
    const after = await getPost(t, id);
    expect(after?.slug).toBe("???");
  });
});

describe("backfillArticleSlugs", () => {
  it("rewrites malformed article slugs via the same shared helper", async () => {
    const t = makeT();
    const userId = await insertUser(t, "user-article");
    const id = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId,
        slug: "hello?",
        title: "Hello",
        body: {},
        createdAt: Date.now(),
        status: "published",
        category: "general",
      }),
    );

    const result = await t.mutation(
      internal.content.backfill.backfillArticleSlugs,
      {},
    );

    expect(result.fixed).toBe(1);
    expect(result.rewrites).toEqual([
      { id, from: "hello?", to: "hello" },
    ]);

    const after = await t.run(async (ctx) => ctx.db.get(id));
    expect(after?.slug).toBe("hello");
  });
});
