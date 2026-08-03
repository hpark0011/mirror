/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";

const agentState = {
  createThreadCalls: 0,
  saveMessageCalls: 0,
  listUIMessagesThreadIds: [] as string[],
  syncStreamsCalls: 0,
};

const authState = {
  currentAuthUser: null as { _id: string } | null,
};

const rateLimitState = {
  calls: 0,
};

vi.mock("@convex-dev/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/agent")>();
  return {
    ...actual,
    createThread: vi.fn(async () => {
      agentState.createThreadCalls += 1;
      return `thread_${agentState.createThreadCalls}`;
    }),
    saveMessage: vi.fn(async () => {
      agentState.saveMessageCalls += 1;
      return { messageId: `message_${agentState.saveMessageCalls}` };
    }),
    listUIMessages: vi.fn(
      async (
        _ctx: unknown,
        _component: unknown,
        args: { threadId: string },
      ) => {
        agentState.listUIMessagesThreadIds.push(args.threadId);
        return {
          page: [{ id: `message_for_${args.threadId}` }],
          isDone: true,
          continueCursor: "",
        };
      },
    ),
    syncStreams: vi.fn(async () => {
      agentState.syncStreamsCalls += 1;
      return [];
    }),
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
    createTool: vi.fn((definition: unknown) => definition),
  };
});

vi.mock("ai", () => ({
  embed: vi.fn(async () => {
    throw new Error("embed stubbed");
  }),
  embedMany: vi.fn(async () => ({ embeddings: [] })),
  stepCountIs: vi.fn((count: number) => {
    return ({ steps }: { steps: unknown[] }) => steps.length === count;
  }),
}));

vi.mock("@ai-sdk/google", () => ({
  google: {
    textEmbeddingModel: vi.fn(() => ({})),
  },
}));

vi.mock("../../auth/client", () => ({
  authComponent: {
    safeGetAuthUser: vi.fn(async () => authState.currentAuthUser),
  },
}));

vi.mock("../rateLimits", () => ({
  chatRateLimiter: {
    limit: vi.fn(async () => {
      rateLimitState.calls += 1;
      return { ok: true, retryAfter: undefined };
    }),
  },
}));

import { api, internal } from "../../_generated/api";
import { normalizeConvexGlob } from "./testUtils";

const rawChatModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawChatModules);

function makeT() {
  return convexTest(schema, modules);
}

async function seedLegacyAndPublicConversations(t: ReturnType<typeof makeT>) {
  return t.run(async (ctx) => {
    const profileOwnerId = await ctx.db.insert("users", {
      authId: "legacy_quarantine_owner",
      email: "legacy-quarantine-owner@example.com",
      name: "Legacy Quarantine Owner",
      onboardingComplete: true,
    });
    const configurationId = await ctx.db.insert("conversations", {
      profileOwnerId,
      viewerId: profileOwnerId,
      mode: "configuration",
      threadId: "thread_legacy_configuration_quarantine",
      status: "active",
      title: "Legacy private configuration chat",
      streamingInProgress: false,
      streamingStartedAt: 123,
    });
    const publicId = await ctx.db.insert("conversations", {
      profileOwnerId,
      viewerId: profileOwnerId,
      threadId: "thread_current_public_chat",
      status: "active",
      title: "Current public chat",
    });

    return { profileOwnerId, configurationId, publicId };
  });
}

async function getStoredState(t: ReturnType<typeof makeT>) {
  return t.run(async (ctx) => ({
    conversations: await ctx.db.query("conversations").take(10),
    scheduledFunctions: await ctx.db.system
      .query("_scheduled_functions")
      .take(10),
  }));
}

beforeEach(() => {
  agentState.createThreadCalls = 0;
  agentState.saveMessageCalls = 0;
  agentState.listUIMessagesThreadIds = [];
  agentState.syncStreamsCalls = 0;
  authState.currentAuthUser = null;
  rateLimitState.calls = 0;
});

describe("legacy configuration conversation quarantine", () => {
  it("hides configuration rows from every conversation read boundary", async () => {
    const t = makeT();
    const { profileOwnerId, configurationId, publicId } =
      await seedLegacyAndPublicConversations(t);
    authState.currentAuthUser = { _id: "legacy_quarantine_owner" };

    const conversations = await t.query(api.chat.queries.getConversations, {
      profileOwnerId,
    });
    expect(conversations.map((conversation) => conversation._id)).toEqual([
      publicId,
    ]);

    await expect(
      t.query(api.chat.queries.getConversation, {
        conversationId: configurationId,
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.chat.queries.getConversation, {
        conversationId: publicId,
      }),
    ).resolves.toMatchObject({
      _id: publicId,
      profileOwnerId,
      threadId: "thread_current_public_chat",
    });

    await expect(
      t.query(internal.chat.queries.internalGetConversation, {
        conversationId: configurationId,
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(internal.chat.queries.internalGetConversation, {
        conversationId: publicId,
      }),
    ).resolves.toMatchObject({
      _id: publicId,
      profileOwnerId,
      threadId: "thread_current_public_chat",
    });
  });

  it("does not load component messages for a configuration thread", async () => {
    const t = makeT();
    const { configurationId, publicId } =
      await seedLegacyAndPublicConversations(t);
    authState.currentAuthUser = { _id: "legacy_quarantine_owner" };
    const paginationOpts = { numItems: 20, cursor: null };

    await expect(
      t.query(api.chat.queries.listThreadMessages, {
        threadId: "thread_legacy_configuration_quarantine",
        conversationId: configurationId,
        paginationOpts,
      }),
    ).resolves.toBeNull();
    expect(agentState.listUIMessagesThreadIds).toEqual([]);
    expect(agentState.syncStreamsCalls).toBe(0);

    await expect(
      t.query(api.chat.queries.listThreadMessages, {
        threadId: "thread_current_public_chat",
        conversationId: publicId,
        paginationOpts,
      }),
    ).resolves.toMatchObject({
      page: [{ id: "message_for_thread_current_public_chat" }],
      isDone: true,
    });
    expect(agentState.listUIMessagesThreadIds).toEqual([
      "thread_current_public_chat",
    ]);
    expect(agentState.syncStreamsCalls).toBe(0);
  });

  it("rejects sending to a configuration row before any stateful work", async () => {
    const t = makeT();
    const { profileOwnerId, configurationId, publicId } =
      await seedLegacyAndPublicConversations(t);
    authState.currentAuthUser = { _id: "legacy_quarantine_owner" };

    await expect(
      t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId: configurationId,
        content: "Do not persist this message",
      }),
    ).rejects.toThrow("Conversation not found");

    const rejectedState = await getStoredState(t);
    expect(rejectedState.conversations).toHaveLength(2);
    expect(
      rejectedState.conversations.find(
        (conversation) => conversation._id === configurationId,
      ),
    ).toMatchObject({
      streamingInProgress: false,
      streamingStartedAt: 123,
    });
    expect(rejectedState.scheduledFunctions).toEqual([]);
    expect(agentState.createThreadCalls).toBe(0);
    expect(agentState.saveMessageCalls).toBe(0);
    expect(rateLimitState.calls).toBe(0);

    await expect(
      t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId: publicId,
        content: "Persist this public message",
      }),
    ).resolves.toEqual({ conversationId: publicId });
    const publicState = await getStoredState(t);
    expect(
      publicState.conversations.find(
        (conversation) => conversation._id === publicId,
      ),
    ).toMatchObject({ streamingInProgress: true });
    expect(publicState.scheduledFunctions).toHaveLength(1);
    expect(agentState.saveMessageCalls).toBe(1);
    expect(rateLimitState.calls).toBe(2);
  });

  it("rejects retrying a configuration row before lock or scheduling work", async () => {
    const t = makeT();
    const { configurationId, publicId } =
      await seedLegacyAndPublicConversations(t);
    authState.currentAuthUser = { _id: "legacy_quarantine_owner" };

    await expect(
      t.mutation(api.chat.mutations.retryMessage, {
        conversationId: configurationId,
      }),
    ).rejects.toThrow("Conversation not found");

    const rejectedState = await getStoredState(t);
    expect(
      rejectedState.conversations.find(
        (conversation) => conversation._id === configurationId,
      ),
    ).toMatchObject({
      streamingInProgress: false,
      streamingStartedAt: 123,
    });
    expect(rejectedState.scheduledFunctions).toEqual([]);
    expect(agentState.saveMessageCalls).toBe(0);
    expect(rateLimitState.calls).toBe(0);

    await expect(
      t.mutation(api.chat.mutations.retryMessage, {
        conversationId: publicId,
      }),
    ).resolves.toBeNull();
    const publicState = await getStoredState(t);
    expect(
      publicState.conversations.find(
        (conversation) => conversation._id === publicId,
      ),
    ).toMatchObject({ streamingInProgress: true });
    expect(publicState.scheduledFunctions).toHaveLength(1);
    expect(agentState.saveMessageCalls).toBe(0);
    expect(rateLimitState.calls).toBe(2);
  });

  it("rejects configuration streaming context while loading public context", async () => {
    const t = makeT();
    const { profileOwnerId, configurationId, publicId } =
      await seedLegacyAndPublicConversations(t);

    await expect(
      t.query(internal.chat.helpers.loadStreamingContext, {
        conversationId: configurationId,
        profileOwnerId,
      }),
    ).rejects.toThrow("Conversation not found");

    await expect(
      t.query(internal.chat.helpers.loadStreamingContext, {
        conversationId: publicId,
        profileOwnerId,
      }),
    ).resolves.toMatchObject({
      threadId: "thread_current_public_chat",
      viewerId: profileOwnerId,
    });
    const state = await getStoredState(t);
    expect(state.scheduledFunctions).toEqual([]);
    expect(agentState.createThreadCalls).toBe(0);
    expect(agentState.saveMessageCalls).toBe(0);
    expect(rateLimitState.calls).toBe(0);
  });
});
