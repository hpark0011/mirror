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
};

const authState = {
  calls: 0,
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
    safeGetAuthUser: vi.fn(async () => {
      authState.calls += 1;
      return authState.currentAuthUser;
    }),
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

import { api } from "../../_generated/api";
import { normalizeConvexGlob } from "./testUtils";

const rawChatModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawChatModules);

function makeT() {
  return convexTest(schema, modules);
}

beforeEach(() => {
  agentState.createThreadCalls = 0;
  agentState.saveMessageCalls = 0;
  authState.calls = 0;
  authState.currentAuthUser = null;
  rateLimitState.calls = 0;
});

describe("Release A previous-client chat contract", () => {
  it("accepts mode: clone for query, send, and retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T00:00:00Z"));

    try {
      const t = makeT();
      const { profileOwnerId, conversationId } = await t.run(async (ctx) => {
        const profileOwnerId = await ctx.db.insert("users", {
          authId: "rollout_owner",
          email: "rollout-owner@example.com",
          onboardingComplete: true,
        });
        const conversationId = await ctx.db.insert("conversations", {
          profileOwnerId,
          viewerId: profileOwnerId,
          threadId: "thread_existing_clone",
          status: "active",
          title: "Existing public chat",
        });
        return { profileOwnerId, conversationId };
      });
      authState.currentAuthUser = { _id: "rollout_owner" };

      const conversations = await t.query(api.chat.queries.getConversations, {
        profileOwnerId,
        mode: "clone",
      });
      expect(conversations.map((conversation) => conversation._id)).toEqual([
        conversationId,
      ]);

      const sent = await t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        mode: "clone",
        content: "Hello from an already-loaded client",
      });
      const sentConversation = await t.run(async (ctx) =>
        ctx.db.get(sent.conversationId),
      );
      expect(sentConversation).toMatchObject({
        profileOwnerId,
        viewerId: profileOwnerId,
        streamingInProgress: true,
      });
      expect(sentConversation?.mode).toBeUndefined();

      await t.mutation(api.chat.mutations.retryMessage, {
        conversationId,
        mode: "clone",
      });
      const retriedConversation = await t.run(async (ctx) =>
        ctx.db.get(conversationId),
      );
      expect(retriedConversation?.streamingInProgress).toBe(true);
      expect(agentState.createThreadCalls).toBe(1);
      expect(agentState.saveMessageCalls).toBe(1);
      expect(rateLimitState.calls).toBe(4);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("keeps mode: configuration requests inert", async () => {
    const t = makeT();
    const { profileOwnerId, configurationId } = await t.run(async (ctx) => {
      const profileOwnerId = await ctx.db.insert("users", {
        authId: "quarantine_owner",
        email: "quarantine-owner@example.com",
        onboardingComplete: true,
      });
      const configurationId = await ctx.db.insert("conversations", {
        profileOwnerId,
        viewerId: profileOwnerId,
        mode: "configuration",
        threadId: "thread_legacy_configuration",
        status: "active",
        title: "Legacy configuration chat",
      });
      return { profileOwnerId, configurationId };
    });
    authState.currentAuthUser = { _id: "quarantine_owner" };

    await expect(
      t.query(api.chat.queries.getConversations, {
        profileOwnerId,
        mode: "configuration",
      }),
    ).resolves.toEqual([]);
    await expect(
      t.mutation(api.chat.mutations.sendMessage, {
        profileOwnerId,
        conversationId: configurationId,
        mode: "configuration",
        content: "Do not persist this",
      }),
    ).rejects.toThrow("Configuration chat is no longer available");
    await expect(
      t.mutation(api.chat.mutations.retryMessage, {
        conversationId: configurationId,
        mode: "configuration",
      }),
    ).rejects.toThrow("Configuration chat is no longer available");

    const state = await t.run(async (ctx) => ({
      conversations: await ctx.db.query("conversations").take(2),
      scheduledFunctions: await ctx.db.system
        .query("_scheduled_functions")
        .take(1),
    }));
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0]).toMatchObject({
      _id: configurationId,
      mode: "configuration",
    });
    expect(state.conversations[0].streamingInProgress).toBeUndefined();
    expect(state.scheduledFunctions).toEqual([]);
    expect(authState.calls).toBe(0);
    expect(agentState.createThreadCalls).toBe(0);
    expect(agentState.saveMessageCalls).toBe(0);
    expect(rateLimitState.calls).toBe(0);
  });
});
