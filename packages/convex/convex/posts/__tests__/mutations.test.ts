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

// `posts/mutations.ts` calls `authComponent.getAuthUser` via `authMutation`
// in `lib/auth.ts`. Stub the auth client so `convex-test` can drive the
// mutation without a real Better Auth runtime.
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
  authId = "auth_posts_owner",
  email = "posts-owner@example.com",
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

describe("posts.mutations.create — slug normalization", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("normalizes a malformed client-supplied slug at the boundary", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const id = await t.mutation(api.posts.mutations.create, {
      title: "Foo",
      slug: "foo?",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.slug).toBe("foo");
  });

  it("falls back to the title when no slug arg is supplied", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const id = await t.mutation(api.posts.mutations.create, {
      title: "Hello World!",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.slug).toBe("hello-world");
  });

  it("treats empty-string slug as 'no slug supplied' and falls back to the title (F5)", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);

    const id = await t.mutation(api.posts.mutations.create, {
      title: "Hello",
      slug: "",
      category: "Creativity",
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
      t.mutation(api.posts.mutations.create, {
        title: "ignored",
        slug: "???",
        category: "Creativity",
        body: { type: "doc", content: [] },
        status: "draft",
      }),
    ).rejects.toThrow(/cannot generate slug/i);
  });
});

describe("posts.mutations.update — slug normalization", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("normalizes a malformed slug at the boundary", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await t.mutation(api.posts.mutations.create, {
      title: "Initial",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });

    await t.mutation(api.posts.mutations.update, {
      id,
      slug: "Bar?",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.slug).toBe("bar");
  });

  it("treats empty-string slug as a no-op (F5) — does NOT throw", async () => {
    const t = makeT();
    await insertAppUserAndSignIn(t);
    const id = await t.mutation(api.posts.mutations.create, {
      title: "Initial",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });
    const before = await t.run(async (ctx) => ctx.db.get(id));

    await expect(
      t.mutation(api.posts.mutations.update, {
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
    const id = await t.mutation(api.posts.mutations.create, {
      title: "Initial",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });
    const before = await t.run(async (ctx) => ctx.db.get(id));

    await t.mutation(api.posts.mutations.update, {
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
    const id = await t.mutation(api.posts.mutations.create, {
      title: "Roundtrip",
      slug: "roundtrip",
      category: "Creativity",
      body: { type: "doc", content: [] },
      status: "draft",
    });
    const before = await t.run(async (ctx) => ctx.db.get(id));
    expect(before?.slug).toBe("roundtrip");

    await expect(
      t.mutation(api.posts.mutations.update, {
        id,
        slug: "roundtrip",
      }),
    ).resolves.toBeNull();

    const after = await t.run(async (ctx) => ctx.db.get(id));
    expect(after?.slug).toBe("roundtrip");
  });
});
