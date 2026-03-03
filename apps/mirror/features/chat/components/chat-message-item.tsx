"use client";

import type { UIMessage } from "@convex-dev/agent/react";
import { useSmoothText } from "@convex-dev/agent/react";
import {
  ChatMessage,
  ChatMessageAvatar,
  ChatMessageBubble,
  ChatMessageContent,
  ChatMessageError,
  ChatMessageLoading,
} from "@feel-good/ui/components/chat-message";
import { getProfileInitials } from "@/features/profile/lib/get-profile-initials";

export function ChatMessageItem({
  message,
  avatarUrl,
  profileName,
  onRetry,
}: {
  message: UIMessage & { role: "user" | "assistant" };
  avatarUrl: string | null;
  profileName: string;
  onRetry?: () => void;
}) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isFailed = message.status === "failed";

  const [smoothText] = useSmoothText(message.text, {
    startStreaming: isStreaming,
  });
  const displayText = isStreaming ? smoothText : message.text;

  const variant = isUser ? "sent" : "received";

  return (
    <ChatMessage variant={variant}>
      {!isUser && (
        <ChatMessageAvatar
          src={avatarUrl}
          alt={profileName}
          fallback={getProfileInitials(profileName)}
        />
      )}
      <ChatMessageContent>
        <ChatMessageBubble variant={variant}>
          {displayText}
          {isStreaming && !displayText && <ChatMessageLoading />}
        </ChatMessageBubble>
        {isFailed && <ChatMessageError onRetry={onRetry} />}
      </ChatMessageContent>
    </ChatMessage>
  );
}
