"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

type RateLimitErrorData = {
  code: "RATE_LIMIT_MINUTE" | "RATE_LIMIT_DAILY";
  retryAfterMs: number;
};

function getRateLimitCode(err: unknown): RateLimitErrorData["code"] | null {
  if (!(err instanceof ConvexError)) return null;
  // ConvexError.data can arrive either as the structured object we threw
  // or as a JSON-serialized string depending on the transport boundary
  // (the convex-test harness surfaces the string form — see
  // packages/convex/convex/chat/__tests__/rateLimits.test.ts#getErrorData).
  const raw: unknown = (err as ConvexError<string>).data;
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (data && typeof data === "object" && "code" in data) {
    const code = (data as { code: unknown }).code;
    if (code === "RATE_LIMIT_DAILY" || code === "RATE_LIMIT_MINUTE") {
      return code;
    }
  }
  return null;
}

function classifySendError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Failed to send message";
  const rateLimitCode = getRateLimitCode(err);
  if (rateLimitCode === "RATE_LIMIT_DAILY") {
    return "You've hit today's chat limit. Try again tomorrow.";
  }
  if (rateLimitCode === "RATE_LIMIT_MINUTE" || /rate limit/i.test(msg)) {
    return "You're sending messages too quickly. Please wait a moment.";
  }
  if (/authentication required/i.test(msg)) {
    return "You need to sign in to chat.";
  }
  if (/already being generated/i.test(msg)) {
    return "Please wait for the current response to complete.";
  }
  return msg;
}

function classifyRetryError(err: unknown): string {
  const rateLimitCode = getRateLimitCode(err);
  if (rateLimitCode === "RATE_LIMIT_DAILY") {
    return "You've hit today's chat limit. Try again tomorrow.";
  }
  if (rateLimitCode === "RATE_LIMIT_MINUTE") {
    return "You're sending messages too quickly. Please wait a moment.";
  }
  return err instanceof Error ? err.message : "Failed to retry";
}

type UseChatSendOptions = {
  profileOwnerId: Id<"users">;
  conversationId: Id<"conversations"> | null;
  onConversationCreated?: (id: Id<"conversations">) => void;
  beginOptimistic: (content: string) => void;
  rollbackOptimistic: () => void;
  markCreatedConversation: (id: Id<"conversations">) => void;
};

export function useChatSend({
  profileOwnerId,
  conversationId,
  onConversationCreated,
  beginOptimistic,
  rollbackOptimistic,
  markCreatedConversation,
}: UseChatSendOptions) {
  const sendMessageMutation = useMutation(api.chat.mutations.sendMessage);
  const retryMessageMutation = useMutation(api.chat.mutations.retryMessage);
  const [sendError, setSendError] = useState<string | null>(null);
  const isSendingRef = useRef(false);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isSendingRef.current) return;
      isSendingRef.current = true;
      setSendError(null);

      beginOptimistic(content);

      try {
        const result = await sendMessageMutation({
          profileOwnerId,
          conversationId: conversationId ?? undefined,
          content,
        });

        // First message creates a new conversation — notify parent.
        // Track the created ID so the conversation switch effect preserves
        // optimistic messages instead of prematurely clearing them.
        if (!conversationId && result.conversationId) {
          markCreatedConversation(result.conversationId);
          onConversationCreated?.(result.conversationId);
        }
      } catch (err) {
        rollbackOptimistic();
        setSendError(classifySendError(err));
      } finally {
        isSendingRef.current = false;
      }
    },
    [
      sendMessageMutation,
      profileOwnerId,
      conversationId,
      onConversationCreated,
      beginOptimistic,
      rollbackOptimistic,
      markCreatedConversation,
    ],
  );

  const retryMessage = useCallback(async () => {
    if (!conversationId) return;
    setSendError(null);

    try {
      await retryMessageMutation({ conversationId });
    } catch (err) {
      setSendError(classifyRetryError(err));
    }
  }, [retryMessageMutation, conversationId]);

  const clearSendError = useCallback(() => {
    setSendError(null);
  }, []);

  return {
    sendMessage,
    retryMessage,
    sendError,
    clearSendError,
  };
}
