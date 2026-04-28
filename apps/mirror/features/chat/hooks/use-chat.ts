"use client";

import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import { useChatMessages } from "./use-chat-messages";
import { useChatOptimistic } from "./use-chat-optimistic";
import { useChatSend } from "./use-chat-send";

type UseChatOptions = {
  profileOwnerId: Id<"users">;
  conversationId: Id<"conversations"> | null;
  onConversationCreated?: (id: Id<"conversations">) => void;
};

export function useChat({
  profileOwnerId,
  conversationId,
  onConversationCreated,
}: UseChatOptions) {
  const {
    conversation,
    conversationNotFound,
    messages,
    status,
    loadMore,
    isStreaming,
  } = useChatMessages({ conversationId });

  const {
    mergedMessages,
    isResponding,
    resolvedStatus,
    sendAnimationKey,
    beginOptimistic,
    rollbackOptimistic,
    markCreatedConversation,
  } = useChatOptimistic({
    conversationId,
    messages,
    status,
    isStreaming,
  });

  const { sendMessage, retryMessage, sendError, clearSendError } = useChatSend({
    profileOwnerId,
    conversationId,
    onConversationCreated,
    beginOptimistic,
    rollbackOptimistic,
    markCreatedConversation,
  });

  return {
    messages: mergedMessages,
    sendMessage,
    retryMessage,
    isResponding,
    conversation,
    conversationNotFound,
    status: resolvedStatus,
    loadMore,
    sendError,
    clearSendError,
    sendAnimationKey,
  };
}
