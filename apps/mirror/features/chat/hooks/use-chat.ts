"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

type UseChatOptions = {
  profileOwnerId: Id<"users">;
  conversationId: Id<"conversations"> | null;
  onConversationCreated?: (id: Id<"conversations">) => void;
};

// Our listThreadMessages query uses `conversationId` alongside `threadId` for
// access control, but useUIMessages expects `threadId` as the sole identifier.
// This type assertion bridges the gap — runtime behavior is correct since the
// hook passes all args through to usePaginatedQuery. The `stream: true` option
// also needs the assertion because the StreamQuery constraint checks for
// threadId-only args.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listMessagesQuery = api.chat.queries.listThreadMessages as any;

export function useChat({
  profileOwnerId,
  conversationId,
  onConversationCreated,
}: UseChatOptions) {
  const sendMessageMutation = useMutation(api.chat.mutations.sendMessage);
  const retryMessageMutation = useMutation(api.chat.mutations.retryMessage);
  const [sendError, setSendError] = useState<string | null>(null);

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

  const messages = (results ?? []) as UIMessage[];
  const isStreaming = conversation?.streamingInProgress ?? false;

  const isSendingRef = useRef(false);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isSendingRef.current) return;
      isSendingRef.current = true;
      setSendError(null);

      try {
        const result = await sendMessageMutation({
          profileOwnerId,
          conversationId: conversationId ?? undefined,
          content,
        });

        // First message creates a new conversation — notify parent
        if (!conversationId && result.conversationId) {
          onConversationCreated?.(result.conversationId);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to send message";
        if (/rate limit/i.test(msg)) {
          setSendError(
            "You're sending messages too quickly. Please wait a moment.",
          );
        } else if (/authentication required/i.test(msg)) {
          setSendError("You need to sign in to chat.");
        } else if (/already being generated/i.test(msg)) {
          setSendError("Please wait for the current response to complete.");
        } else {
          setSendError(msg);
        }
      } finally {
        isSendingRef.current = false;
      }
    },
    [sendMessageMutation, profileOwnerId, conversationId, onConversationCreated],
  );

  const retryMessage = useCallback(async () => {
    if (!conversationId) return;
    setSendError(null);

    try {
      await retryMessageMutation({ conversationId });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to retry";
      setSendError(msg);
    }
  }, [retryMessageMutation, conversationId]);

  const clearSendError = useCallback(() => {
    setSendError(null);
  }, []);

  return {
    messages,
    sendMessage,
    retryMessage,
    isStreaming,
    conversation,
    conversationNotFound,
    status,
    loadMore,
    sendError,
    clearSendError,
  };
}
