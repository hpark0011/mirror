"use client";

import { memo } from "react";
import type { UIMessage } from "@convex-dev/agent/react";
import { useSmoothText } from "@convex-dev/agent/react";
import {
  ChatMessage,
  ChatMessageBubble,
  ChatMessageContent,
  ChatMessageError,
  ChatMessageLoading,
} from "@feel-good/ui/components/chat-message";
import { MirrorAvatar } from "@/components/mirror-avatar";
import { BookFlip } from "@/components/animated-geometries/book-flip";

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  avatarUrl,
  profileName,
  onRetry,
  animateSend,
}: {
  message: UIMessage & { role: "user" | "assistant" };
  avatarUrl: string | null;
  profileName: string;
  onRetry?: () => void;
  animateSend?: boolean;
}) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isFailed = message.status === "failed";

  const [smoothText] = useSmoothText(message.text, {
    startStreaming: isStreaming,
  });
  const displayText = isStreaming ? smoothText : message.text;
  const showsEmptyAssistant = !isUser && !displayText;
  const showsPendingAssistant = showsEmptyAssistant &&
    (message.status === "streaming" || message.status === "pending");

  const variant = isUser ? "sent" : "received";

  return (
    <ChatMessage variant={variant}>
      {!isUser && (
        <div className="flex flex-col justify-end relative">
          <MirrorAvatar
            shape="circle"
            className="size-8 shrink-0 rounded-full relative bottom-[-8px]"
            avatarUrl={avatarUrl}
            profileName={profileName}
          />
        </div>
      )}
      <ChatMessageContent>
        <ChatMessageBubble
          variant={variant}
          data-assistant-empty={showsEmptyAssistant ? "true" : undefined}
          data-pending-assistant={showsPendingAssistant ? "true" : undefined}
          className={animateSend
            ? "animate-message-send origin-bottom-right"
            : undefined}
        >
          {displayText}
          {isStreaming && !displayText && isUser && <ChatMessageLoading />}
          {showsPendingAssistant && <BookFlip />}
        </ChatMessageBubble>
        {isFailed && <ChatMessageError onRetry={onRetry} />}
      </ChatMessageContent>
    </ChatMessage>
  );
});
