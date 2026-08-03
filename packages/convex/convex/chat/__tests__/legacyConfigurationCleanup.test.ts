/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../../_generated/api";
import schema from "../../schema";
import { clearedUserCustomizationFields } from "../../migrations/removeSettings";
import { normalizeConvexGlob } from "./testUtils";

const cleanupState = {
  error: null as Error | null,
  deletedThreadIds: [] as string[],
};

vi.mock("../agent", () => ({
  cloneAgent: {
    deleteThreadSync: vi.fn(
      async (_ctx: unknown, { threadId }: { threadId: string }) => {
        if (cleanupState.error) throw cleanupState.error;
        cleanupState.deletedThreadIds.push(threadId);
      },
    ),
  },
}));

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawModules);

function makeT() {
  return convexTest(schema, modules);
}

async function seedConversations(t: ReturnType<typeof makeT>) {
  return t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      authId: "legacy_cleanup_owner",
      email: "legacy-cleanup@example.com",
      onboardingComplete: true,
    });
    const cloneId = await ctx.db.insert("conversations", {
      profileOwnerId: ownerId,
      mode: "clone",
      threadId: "thread_clone_keep",
      status: "active",
      title: "Public chat",
    });
    const configurationId = await ctx.db.insert("conversations", {
      profileOwnerId: ownerId,
      mode: "configuration",
      threadId: "thread_configuration_delete_first",
      status: "active",
      title: "First legacy private chat",
    });
    const configurationTwoId = await ctx.db.insert("conversations", {
      profileOwnerId: ownerId,
      mode: "configuration",
      threadId: "thread_configuration_delete_second",
      status: "archived",
      title: "Second legacy private chat",
    });
    const missingModeId = await ctx.db.insert("conversations", {
      profileOwnerId: ownerId,
      threadId: "thread_missing_mode_keep",
      status: "archived",
      title: "Current public chat",
    });
    return { cloneId, configurationId, configurationTwoId, missingModeId };
  });
}

describe("legacy configuration conversation cleanup", () => {
  beforeEach(() => {
    cleanupState.error = null;
    cleanupState.deletedThreadIds = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves clone rows and makes local deletion idempotent", async () => {
    const t = makeT();
    const { cloneId, configurationId } = await seedConversations(t);

    await expect(
      t.mutation(internal.chat.legacyConfigurationCleanup.deleteLocalRow, {
        conversationId: cloneId,
        expectedThreadId: "thread_clone_keep",
      }),
    ).resolves.toBe(false);
    await expect(
      t.mutation(internal.chat.legacyConfigurationCleanup.deleteLocalRow, {
        conversationId: configurationId,
        expectedThreadId: "thread_configuration_delete_first",
      }),
    ).resolves.toBe(true);
    await expect(
      t.mutation(internal.chat.legacyConfigurationCleanup.deleteLocalRow, {
        conversationId: configurationId,
        expectedThreadId: "thread_configuration_delete_first",
      }),
    ).resolves.toBe(false);

    const clone = await t.run(async (ctx) => ctx.db.get(cloneId));
    expect(clone?.threadId).toBe("thread_clone_keep");
  });

  it("deletes every configuration thread and terminates idempotently", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const { cloneId, configurationId, configurationTwoId, missingModeId } =
      await seedConversations(t);

    await expect(
      t.action(internal.chat.legacyConfigurationCleanup.cleanupNext, {}),
    ).resolves.toEqual({ cleaned: true, complete: false });

    expect(cleanupState.deletedThreadIds).toEqual([
      "thread_configuration_delete_first",
    ]);
    const stateAfterFirstCleanup = await t.run(async (ctx) => ({
      clone: await ctx.db.get(cloneId),
      firstConfiguration: await ctx.db.get(configurationId),
      secondConfiguration: await ctx.db.get(configurationTwoId),
      missingMode: await ctx.db.get(missingModeId),
    }));
    expect(stateAfterFirstCleanup.firstConfiguration).toBeNull();
    expect(stateAfterFirstCleanup.secondConfiguration).toMatchObject({
      mode: "configuration",
      threadId: "thread_configuration_delete_second",
      status: "archived",
    });
    expect(stateAfterFirstCleanup.clone).toMatchObject({
      mode: "clone",
      threadId: "thread_clone_keep",
      status: "active",
    });
    expect(stateAfterFirstCleanup.missingMode).toMatchObject({
      threadId: "thread_missing_mode_keep",
      status: "archived",
    });
    expect(stateAfterFirstCleanup.missingMode).not.toHaveProperty("mode");

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(cleanupState.deletedThreadIds).toEqual([
      "thread_configuration_delete_first",
      "thread_configuration_delete_second",
    ]);
    const finalState = await t.run(async (ctx) => ({
      clone: await ctx.db.get(cloneId),
      firstConfiguration: await ctx.db.get(configurationId),
      secondConfiguration: await ctx.db.get(configurationTwoId),
      missingMode: await ctx.db.get(missingModeId),
    }));
    expect(finalState.firstConfiguration).toBeNull();
    expect(finalState.secondConfiguration).toBeNull();
    expect(finalState.clone).toMatchObject({
      mode: "clone",
      threadId: "thread_clone_keep",
      status: "active",
    });
    expect(finalState.missingMode).toMatchObject({
      threadId: "thread_missing_mode_keep",
      status: "archived",
    });
    expect(finalState.missingMode).not.toHaveProperty("mode");

    await expect(
      t.action(internal.chat.legacyConfigurationCleanup.cleanupNext, {}),
    ).resolves.toEqual({ cleaned: false, complete: true });
    expect(cleanupState.deletedThreadIds).toEqual([
      "thread_configuration_delete_first",
      "thread_configuration_delete_second",
    ]);
  });

  it("retains the local row when component thread deletion fails", async () => {
    const t = makeT();
    const { configurationId } = await seedConversations(t);
    cleanupState.error = new Error("component unavailable");

    await expect(
      t.action(internal.chat.legacyConfigurationCleanup.cleanupNext, {}),
    ).rejects.toThrow("component unavailable");

    const row = await t.run(async (ctx) => ctx.db.get(configurationId));
    expect(row?.threadId).toBe("thread_configuration_delete_first");
    expect(cleanupState.deletedThreadIds).toEqual([]);
  });
});

describe("user customization migration", () => {
  it("clears all five legacy fields and is stable across retries", () => {
    const first = clearedUserCustomizationFields();
    const second = clearedUserCustomizationFields();

    expect(first).toEqual({
      personaPrompt: undefined,
      tonePreset: undefined,
      topicsToAvoid: undefined,
      chatAuthRequired: undefined,
      defaultProfileSection: undefined,
    });
    expect(second).toEqual(first);
  });
});
