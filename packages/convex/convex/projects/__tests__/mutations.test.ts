/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";
import { buildEmbeddingUserSourceKey } from "../../embeddings/schema";

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
import { type Id } from "../../_generated/dataModel";

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../projects/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../projects/" + k.slice(3);
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

function utcMonth(year: number, month: number): number {
  return Date.UTC(year, month - 1, 1);
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

async function storeBlob(t: ReturnType<typeof makeT>): Promise<Id<"_storage">> {
  return t.run(async (ctx) => ctx.storage.store(new Blob(["project cover"])));
}

async function seedCoverOwnership(
  t: ReturnType<typeof makeT>,
  storageId: Id<"_storage">,
  userId: Id<"users">,
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("coverImageOwnership", {
      storageId,
      userId,
      kind: "image",
      createdAt: Date.now(),
    });
  });
}

async function readCoverStorageState(
  t: ReturnType<typeof makeT>,
  storageId: Id<"_storage">,
) {
  return t.run(async (ctx) => {
    const ownership = await ctx.db
      .query("coverImageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    return {
      storageExists: (await ctx.db.system.get(storageId)) !== null,
      ownershipExists: ownership !== null,
    };
  });
}

describe("projects.mutations", () => {
  beforeEach(() => {
    authState.currentAuthUser = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects when not authenticated", async () => {
    const t = makeT();

    await expect(
      t.mutation(api.projects.mutations.create, {
        title: "Mirror",
        startDate: utcMonth(2025, 1),
        endDate: null,
      }),
    ).rejects.toThrow();
  });

  it("inserts with the owner userId from auth context and no client userId", async () => {
    const t = makeT();
    const ownerId = await signInAs(t, "auth_project_owner", "project_owner");

    const id = await t.mutation(api.projects.mutations.create, {
      title: "Mirror Projects",
      description: "A portfolio project.",
      link: "https://example.com/mirror",
      startDate: utcMonth(2025, 1),
      endDate: null,
    });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(ownerId);
    expect(row!.title).toBe("Mirror Projects");

    await expect(
      t.mutation(api.projects.mutations.create, {
        title: "Bad args",
        startDate: utcMonth(2025, 1),
        endDate: null,
        // @ts-expect-error — intentionally an unknown arg
        userId: ownerId,
      }),
    ).rejects.toThrow(/Validator error.*Unexpected field.*userId/);
  });

  it("rejects invalid title, non-HTTPS link, and inverted dates", async () => {
    const t = makeT();
    await signInAs(t, "auth_project_validation");

    await expect(
      t.mutation(api.projects.mutations.create, {
        title: " ",
        startDate: utcMonth(2025, 1),
        endDate: null,
      }),
    ).rejects.toThrow(/title is required/i);

    await expect(
      t.mutation(api.projects.mutations.create, {
        title: "HTTP link",
        link: "http://example.com",
        startDate: utcMonth(2025, 1),
        endDate: null,
      }),
    ).rejects.toThrow(/https/i);

    await expect(
      t.mutation(api.projects.mutations.create, {
        title: "Bad dates",
        startDate: utcMonth(2025, 6),
        endDate: utcMonth(2025, 1),
      }),
    ).rejects.toThrow(/endDate must be greater than or equal to startDate/i);
  });

  it("enforces max 50 projects per user", async () => {
    const t = makeT();
    const ownerId = await signInAs(t, "auth_project_limit");

    await t.run(async (ctx) => {
      for (let i = 0; i < 50; i += 1) {
        await ctx.db.insert("projects", {
          userId: ownerId,
          title: `Project ${i}`,
          startDate: utcMonth(2024, 1),
          endDate: null,
          createdAt: 1000 + i,
          updatedAt: 1000 + i,
        });
      }
    });

    await expect(
      t.mutation(api.projects.mutations.create, {
        title: "Project 51",
        startDate: utcMonth(2025, 1),
        endDate: null,
      }),
    ).rejects.toThrow(/project limit reached/i);
  });

  it("rejects update and delete by a different authenticated user", async () => {
    const t = makeT();
    const ownerId = await signInAs(t, "auth_project_a", "project_a");
    const id = await t.run(async (ctx) =>
      ctx.db.insert("projects", {
        userId: ownerId,
        title: "Private ownership",
        startDate: utcMonth(2025, 1),
        endDate: null,
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    await signInAs(t, "auth_project_b", "project_b");

    await expect(
      t.mutation(api.projects.mutations.update, {
        id,
        title: "Hijacked",
      }),
    ).rejects.toThrow(/not authorized/i);

    await expect(
      t.mutation(api.projects.mutations.remove, { id }),
    ).rejects.toThrow(/not authorized/i);
  });

  it("deletes stale embedding chunks when a project is removed", async () => {
    vi.useFakeTimers();

    const t = makeT();
    const ownerId = await signInAs(t, "auth_project_embeddings");
    const id = await t.run(async (ctx) => {
      const projectId = await ctx.db.insert("projects", {
        userId: ownerId,
        title: "Embedded Project",
        startDate: utcMonth(2025, 1),
        endDate: null,
        createdAt: 1000,
        updatedAt: 1000,
      });
      await ctx.db.insert("contentEmbeddings", {
        sourceTable: "projects",
        sourceId: projectId,
        userId: ownerId,
        userSourceKey: buildEmbeddingUserSourceKey(ownerId, "projects"),
        chunkIndex: 0,
        chunkText: "Embedded Project",
        title: "Embedded Project",
        embedding: new Array(768).fill(0.01),
        embeddingModel: "test",
        embeddedAt: 1000,
      });
      return projectId;
    });

    await t.mutation(api.projects.mutations.remove, { id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const chunks = await t.run(async (ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourceTable_and_sourceId", (q) =>
          q.eq("sourceTable", "projects").eq("sourceId", id),
        )
        .collect(),
    );
    expect(chunks).toHaveLength(0);
  });

  it("deletes old cover blobs on cover replacement and removal", async () => {
    const t = makeT();
    const ownerId = await signInAs(t, "auth_project_covers");
    const original = await storeBlob(t);
    const replacement = await storeBlob(t);
    await seedCoverOwnership(t, original, ownerId);
    await seedCoverOwnership(t, replacement, ownerId);

    const id = await t.mutation(api.projects.mutations.create, {
      title: "Covered Project",
      startDate: utcMonth(2025, 1),
      endDate: null,
      coverImageStorageId: original,
    });

    await t.mutation(api.projects.mutations.update, {
      id,
      coverImageStorageId: replacement,
    });
    expect(await readCoverStorageState(t, original)).toEqual({
      storageExists: false,
      ownershipExists: false,
    });
    expect(await readCoverStorageState(t, replacement)).toEqual({
      storageExists: true,
      ownershipExists: true,
    });

    await t.mutation(api.projects.mutations.update, {
      id,
      clearCover: true,
    });
    expect(await readCoverStorageState(t, replacement)).toEqual({
      storageExists: false,
      ownershipExists: false,
    });
  });
});
