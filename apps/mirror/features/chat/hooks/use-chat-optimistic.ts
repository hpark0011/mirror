"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type UIMessage } from "@convex-dev/agent/react";
import { type PaginationStatus } from "convex/react";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import {
  countMessagesByRole,
  findFirstNewAssistant,
  findInsertIndexBeforeNewAssistant,
} from "../utils/optimistic-merge";

type UseChatOptimisticOptions = {
  conversationId: Id<"conversations"> | null;
  messages: UIMessage[];
  status: PaginationStatus;
  isStreaming: boolean;
};

export function useChatOptimistic({
  conversationId,
  messages,
  status,
  isStreaming,
}: UseChatOptimisticOptions) {
  const [sendAnimationKey, setSendAnimationKey] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<UIMessage[]>([]);
  const [pendingAssistantMessage, setPendingAssistantMessage] =
    useState<UIMessage | null>(null);
  // Baselines + streaming-observed flag are state because they are read during
  // render to drive the optimistic merge. Using refs would violate the React
  // Compiler "no ref reads during render" rule and skip optimization.
  const [realUserCountBaseline, setRealUserCountBaseline] =
    useState<number | null>(null);
  const [realAssistantCountBaseline, setRealAssistantCountBaseline] =
    useState<number | null>(null);
  const [hasObservedStreaming, setHasObservedStreaming] = useState(false);
  // createdConversationRef is only read inside the conversation-switch effect,
  // never during render — staying as a ref is correct.
  const createdConversationRef = useRef<Id<"conversations"> | null>(null);

  const messageCounts = useMemo(() => countMessagesByRole(messages), [messages]);
  const realUserCount = messageCounts.user;
  const realAssistantCount = messageCounts.assistant;
  const userBaseline = realUserCountBaseline ?? 0;
  const assistantBaseline = realAssistantCountBaseline ?? 0;
  const firstNewAssistant = useMemo(
    () => findFirstNewAssistant(messages, assistantBaseline),
    [messages, assistantBaseline],
  );
  const firstNewAssistantMessage = firstNewAssistant?.message ?? null;
  const firstNewAssistantHasText = firstNewAssistantMessage !== null
    && firstNewAssistantMessage.text.length > 0;
  const firstNewAssistantSettledWithoutText = firstNewAssistantMessage !== null
    && firstNewAssistantMessage.text.length === 0
    && (
      firstNewAssistantMessage.status === "success"
      || firstNewAssistantMessage.status === "failed"
    );
  const assistantResponseSettled = firstNewAssistantSettledWithoutText
    || (hasObservedStreaming && !isStreaming && !firstNewAssistantHasText);
  const showOptimisticMessages =
    optimisticMessages.length > 0 && realUserCount <= userBaseline;
  const showPendingAssistant =
    pendingAssistantMessage !== null
    && !firstNewAssistantHasText
    && !assistantResponseSettled;
  const shouldSuppressEmptyNewAssistant =
    showPendingAssistant
    && firstNewAssistantMessage !== null
    && firstNewAssistantMessage.text.length === 0;

  // Merge optimistic + real messages
  const mergedMessages = useMemo(() => {
    if (!showOptimisticMessages && !showPendingAssistant) return messages;

    let displayMessages = messages;

    if (showOptimisticMessages) {
      const hasNewAssistantMessages = realAssistantCount > assistantBaseline;
      const insertIndex = hasNewAssistantMessages
        ? findInsertIndexBeforeNewAssistant(messages, assistantBaseline)
        : messages.length;

      displayMessages = hasNewAssistantMessages
        ? [
          ...messages.slice(0, insertIndex),
          ...optimisticMessages,
          ...messages.slice(insertIndex),
        ]
        : [...messages, ...optimisticMessages];
    }

    if (shouldSuppressEmptyNewAssistant && firstNewAssistantMessage) {
      displayMessages = displayMessages.filter(
        (message) => message.key !== firstNewAssistantMessage.key,
      );
    }

    if (showPendingAssistant && pendingAssistantMessage) {
      return [...displayMessages, pendingAssistantMessage];
    }

    return displayMessages;
  }, [
    messages,
    optimisticMessages,
    pendingAssistantMessage,
    showOptimisticMessages,
    showPendingAssistant,
    shouldSuppressEmptyNewAssistant,
    firstNewAssistantMessage,
    realAssistantCount,
    assistantBaseline,
  ]);

  // Clear optimistic messages when real messages arrive.
  // Count-based: when real user message count exceeds the baseline captured
  // at send time, the server has persisted our message. setState-in-effect
  // is intentional: this reconciles client optimistic state with server
  // pagination updates; the original (pre-split) implementation used the
  // same pattern with refs that the React Compiler did not analyse.
  useEffect(() => {
    if (optimisticMessages.length === 0) return;
    if (realUserCount > userBaseline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptimisticMessages([]);
      setRealUserCountBaseline(null);
    }
  }, [optimisticMessages.length, realUserCount, userBaseline]);

  useEffect(() => {
    if (!pendingAssistantMessage) return;
    if (isStreaming) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasObservedStreaming(true);
    }
  }, [pendingAssistantMessage, isStreaming]);

  useEffect(() => {
    if (!pendingAssistantMessage) return;
    if (firstNewAssistantHasText || assistantResponseSettled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingAssistantMessage(null);
      setRealAssistantCountBaseline(null);
      setHasObservedStreaming(false);
    }
  }, [
    pendingAssistantMessage,
    firstNewAssistantHasText,
    assistantResponseSettled,
  ]);

  // Override status to prevent loading spinner flash when optimistic messages
  // exist or when no conversation has been created yet.
  const isResponding = isStreaming || showPendingAssistant;
  const resolvedStatus: PaginationStatus =
    showOptimisticMessages || showPendingAssistant
      ? "Exhausted"
      : conversationId === null
        ? "Exhausted"
        : status;

  // Clear animation key after the CSS animation completes (400ms) to prevent
  // replays on React reconciliation / Convex re-pagination.
  useEffect(() => {
    if (!sendAnimationKey) return;
    const timer = setTimeout(() => setSendAnimationKey(null), 500);
    return () => clearTimeout(timer);
  }, [sendAnimationKey]);

  // Reset on conversation switch.
  // When the switch is caused by our own first-message creation, preserve
  // optimistic messages so there's no loading spinner flash before real
  // messages arrive. For user-initiated navigation, clear everything.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSendAnimationKey(null);
    if (conversationId === createdConversationRef.current) {
      createdConversationRef.current = null;
    } else {
      setOptimisticMessages([]);
      setPendingAssistantMessage(null);
      setRealUserCountBaseline(null);
      setRealAssistantCountBaseline(null);
      setHasObservedStreaming(false);
    }
  }, [conversationId]);

  // Safety timeout — clear stuck optimistic messages after 10s in case
  // dedup fails for any reason (e.g. text mismatch between client/server).
  useEffect(() => {
    if (optimisticMessages.length === 0) return;
    const timer = setTimeout(() => setOptimisticMessages([]), 10_000);
    return () => clearTimeout(timer);
  }, [optimisticMessages.length]);

  const beginOptimistic = useCallback(
    (content: string) => {
      // Create optimistic messages immediately so both the user bubble and
      // assistant placeholder render before the backend stream arrives.
      const optimisticTimestamp = Date.now();
      const optimisticKey = `optimistic-user-${optimisticTimestamp}`;
      const optimisticMsg = {
        key: optimisticKey,
        id: optimisticKey,
        role: "user" as const,
        text: content,
        status: "pending" as const,
        parts: [{ type: "text" as const, text: content }],
        order: optimisticTimestamp,
        stepOrder: 0,
        _creationTime: optimisticTimestamp,
      } satisfies UIMessage;

      const optimisticAssistantKey = `optimistic-assistant-${optimisticTimestamp}`;
      const optimisticAssistantMsg = {
        key: optimisticAssistantKey,
        id: optimisticAssistantKey,
        role: "assistant" as const,
        text: "",
        status: "streaming" as const,
        parts: [],
        order: optimisticTimestamp + 1,
        stepOrder: 0,
        _creationTime: optimisticTimestamp + 1,
      } satisfies UIMessage;

      setRealUserCountBaseline(realUserCount);
      setRealAssistantCountBaseline(realAssistantCount);
      setHasObservedStreaming(false);

      setOptimisticMessages((prev) => [...prev, optimisticMsg]);
      setPendingAssistantMessage(optimisticAssistantMsg);
      setSendAnimationKey(optimisticKey);
    },
    [realUserCount, realAssistantCount],
  );

  const rollbackOptimistic = useCallback(() => {
    setOptimisticMessages([]);
    setPendingAssistantMessage(null);
    setRealUserCountBaseline(null);
    setRealAssistantCountBaseline(null);
    setHasObservedStreaming(false);
  }, []);

  const markCreatedConversation = useCallback((id: Id<"conversations">) => {
    createdConversationRef.current = id;
  }, []);

  return {
    mergedMessages,
    isResponding,
    resolvedStatus,
    sendAnimationKey,
    beginOptimistic,
    rollbackOptimistic,
    markCreatedConversation,
  };
}
