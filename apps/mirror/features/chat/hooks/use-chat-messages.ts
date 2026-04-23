"use client";

import { useQuery } from "convex/react";
import { useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

// Our listThreadMessages query uses `conversationId` alongside `threadId` for
// access control, but useUIMessages expects `threadId` as the sole identifier.
// This type assertion bridges the gap — runtime behavior is correct since the
// hook passes all args through to usePaginatedQuery. The `stream: true` option
// also needs the assertion because the StreamQuery constraint checks for
// threadId-only args.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listMessagesQuery = api.chat.queries.listThreadMessages as any;

const EMPTY_MESSAGES: UIMessage[] = [];

type UseChatMessagesOptions = {
  conversationId: Id<"conversations"> | null;
};

export function useChatMessages({ conversationId }: UseChatMessagesOptions) {
  const conversation = useQuery(
    api.chat.queries.getConversation,
    conversationId ? { conversationId } : "skip",
  );

  const conversationNotFound = conversationId !== null && conversation === null;

  // useUIMessages requires threadId at runtime for streaming delta construction.
  // We get it from the conversation metadata query above.
  const { results, status, loadMore } = useUIMessages(
    listMessagesQuery,
    conversation
      ? { threadId: conversation.threadId, conversationId: conversation._id }
      : "skip",
    { initialNumItems: 20, stream: true },
  );

  // Stabilise the messages array — `results` is undefined when the query is
  // skipped, and `?? []` would create a new reference every render.
  const messages = (results as UIMessage[] | undefined) ?? EMPTY_MESSAGES;
  const isStreaming = conversation?.streamingInProgress ?? false;

  return {
    conversation,
    conversationNotFound,
    messages,
    status,
    loadMore,
    isStreaming,
  };
}
