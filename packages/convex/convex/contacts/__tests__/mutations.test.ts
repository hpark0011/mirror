/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";

const authState = {
  currentAuthUser: null as { _id: string } | null,
};

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
          thread: {
            streamText: vi.fn(async () => undefined),
          },
        };
      }
    },
  };
});

vi.mock("ai", () => {
  return {
    embed: vi.fn(async () => {
      throw new Error("embed stubbed");
    }),
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

vi.mock("../../auth/client", () => {
  return {
    authComponent: {
      safeGetAuthUser: vi.fn(async () => authState.currentAuthUser),
      getAuthUser: vi.fn(async () => {
        if (!authState.currentAuthUser) {
          throw new Error("Not authenticated");
        }
        return authState.currentAuthUser;
      }),
    },
  };
});

import { api } from "../../_generated/api";

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../contacts/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../contacts/" + k.slice(3);
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

async function signInAs(
  t: ReturnType<typeof makeT>,
  authId: string,
  username = `u_${authId}`,
) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: `${authId}@example.com`,
      username,
      onboardingComplete: true,
    }),
  );
  authState.currentAuthUser = { _id: authId };
  return userId;
}

describe("contacts.mutations.create", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects when not authenticated", async () => {
    const t = makeT();
    await expect(
      t.mutation(api.contacts.mutations.create, {
        kind: "email",
        value: "test@example.com",
      }),
    ).rejects.toThrow();
  });

  it("inserts row with userId derived from auth context (never client)", async () => {
    const t = makeT();
    const ownerId = await signInAs(t, "auth_create_email", "user_create_email");

    const id = await t.mutation(api.contacts.mutations.create, {
      kind: "email",
      value: "contact_user@example.com",
    });
    expect(id).toBeDefined();

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(ownerId);
    expect(row!.kind).toBe("email");
    expect(row!.value).toBe("contact_user@example.com");
  });

  it("trims surrounding whitespace from value before persisting", async () => {
    const t = makeT();
    await signInAs(t, "auth_create_trim", "user_create_trim");

    const id = await t.mutation(api.contacts.mutations.create, {
      kind: "linkedin",
      value: "  https://www.linkedin.com/in/hp  ",
    });
    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.value).toBe("https://www.linkedin.com/in/hp");
  });

  it("rejects a duplicate entry for the same (userId, kind) pair", async () => {
    const t = makeT();
    await signInAs(t, "auth_dup", "user_dup");

    await t.mutation(api.contacts.mutations.create, {
      kind: "linkedin",
      value: "https://www.linkedin.com/in/first",
    });

    await expect(
      t.mutation(api.contacts.mutations.create, {
        kind: "linkedin",
        value: "https://www.linkedin.com/in/second",
      }),
    ).rejects.toThrow(/LinkedIn contact already exists/);
  });

  it("allows separate platforms for the same user", async () => {
    const t = makeT();
    await signInAs(t, "auth_multi", "user_multi");

    await t.mutation(api.contacts.mutations.create, {
      kind: "email",
      value: "hp@example.com",
    });
    await t.mutation(api.contacts.mutations.create, {
      kind: "linkedin",
      value: "https://www.linkedin.com/in/hp",
    });
    await t.mutation(api.contacts.mutations.create, {
      kind: "x",
      value: "https://x.com/hp",
    });

    const result = await t.query(api.contacts.queries.getByUsername, {
      username: "user_multi",
    });
    expect(result!.length).toBe(3);
  });

  it("rejects an invalid email", async () => {
    const t = makeT();
    await signInAs(t, "auth_bad_email", "user_bad_email");
    await expect(
      t.mutation(api.contacts.mutations.create, {
        kind: "email",
        value: "not-an-email",
      }),
    ).rejects.toThrow(/email must be a valid email address/);
  });

  it("rejects an http:// URL for a social kind", async () => {
    const t = makeT();
    await signInAs(t, "auth_bad_http", "user_bad_http");
    await expect(
      t.mutation(api.contacts.mutations.create, {
        kind: "linkedin",
        value: "http://example.com/insecure",
      }),
    ).rejects.toThrow(/URL must use https:\/\//);
  });

  it("rejects a malformed URL", async () => {
    const t = makeT();
    await signInAs(t, "auth_bad_url", "user_bad_url");
    await expect(
      t.mutation(api.contacts.mutations.create, {
        kind: "instagram",
        value: "not a url",
      }),
    ).rejects.toThrow(/value must be a valid URL/);
  });

  it("rejects a value that is empty after trim", async () => {
    const t = makeT();
    await signInAs(t, "auth_empty_trim", "user_empty_trim");
    await expect(
      t.mutation(api.contacts.mutations.create, {
        kind: "email",
        value: "   ",
      }),
    ).rejects.toThrow(/value is required/);
  });

  it("rejects a value that exceeds the 2000-char length cap", async () => {
    const t = makeT();
    await signInAs(t, "auth_too_long", "user_too_long");
    // 2001 https-prefix-friendly chars so the URL validator never gets a
    // chance to short-circuit the length check.
    const oversized = `https://example.com/${"a".repeat(2001 - "https://example.com/".length)}`;
    expect(oversized.length).toBe(2001);
    await expect(
      t.mutation(api.contacts.mutations.create, {
        kind: "linkedin",
        value: oversized,
      }),
    ).rejects.toThrow(/exceeds maximum length of 2000/);
  });

  it("create's args validator does NOT include userId", async () => {
    const t = makeT();
    await signInAs(t, "auth_no_user_arg", "user_no_user_arg");
    // Convex validators reject extra args at the boundary.
    await expect(
      t.mutation(
        api.contacts.mutations.create,
        // @ts-expect-error — extra arg deliberately tested at runtime.
        {
          kind: "email",
          value: "ok@example.com",
          userId: "auth_no_user_arg",
        },
      ),
    ).rejects.toThrow();
  });
});

describe("contacts.mutations.update", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("updates the entry value for the owner and leaves the kind untouched", async () => {
    const t = makeT();
    await signInAs(t, "auth_upd", "user_upd");
    const id = await t.mutation(api.contacts.mutations.create, {
      kind: "email",
      value: "old@example.com",
    });

    await t.mutation(api.contacts.mutations.update, {
      id,
      value: "new@example.com",
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row!.value).toBe("new@example.com");
    // The kind-lock invariant: update is value-only. A future refactor that
    // accepts `kind` on update would silently break this assertion.
    expect(row!.kind).toBe("email");
  });

  it("rejects an update from a different signed-in user", async () => {
    const t = makeT();
    await signInAs(t, "auth_owner", "owner_user");
    const id = await t.mutation(api.contacts.mutations.create, {
      kind: "email",
      value: "owner@example.com",
    });

    // Switch to a different signed-in user.
    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_attacker",
        email: "attacker@example.com",
        username: "attacker",
        onboardingComplete: true,
      }),
    );
    authState.currentAuthUser = { _id: "auth_attacker" };

    await expect(
      t.mutation(api.contacts.mutations.update, {
        id,
        value: "stolen@example.com",
      }),
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("contacts.mutations.remove", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  it("deletes the entry for the owner", async () => {
    const t = makeT();
    await signInAs(t, "auth_del", "user_del");
    const id = await t.mutation(api.contacts.mutations.create, {
      kind: "email",
      value: "del@example.com",
    });

    await t.mutation(api.contacts.mutations.remove, { id });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row).toBeNull();
  });

  it("rejects a remove from a different signed-in user", async () => {
    const t = makeT();
    await signInAs(t, "auth_owner_del", "owner_user_del");
    const id = await t.mutation(api.contacts.mutations.create, {
      kind: "email",
      value: "ownerdel@example.com",
    });

    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth_attacker_del",
        email: "attackerdel@example.com",
        username: "attackerdel",
        onboardingComplete: true,
      }),
    );
    authState.currentAuthUser = { _id: "auth_attacker_del" };

    await expect(
      t.mutation(api.contacts.mutations.remove, { id }),
    ).rejects.toThrow(/Not authorized/);
  });
});
