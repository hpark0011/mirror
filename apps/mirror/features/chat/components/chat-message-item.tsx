"use client";

import { memo } from "react";
import { type UIMessage } from "@convex-dev/agent/react";
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

type MessageFilePart = {
  type: "file" | "image";
  mediaType: string;
  url?: string;
  image?: string | URL;
  filename?: string;
};

function getImageParts(message: UIMessage): MessageFilePart[] {
  const imageParts: MessageFilePart[] = [];
  for (const part of message.parts) {
    if (!part || typeof part !== "object") continue;
    const candidate = part as Record<string, unknown>;
    const type = candidate.type === "image" ? "image" : "file";
    if (candidate.type !== "file" && candidate.type !== "image") continue;
    if (
      typeof candidate.mediaType !== "string" ||
      !candidate.mediaType.startsWith("image/")
    ) {
      continue;
    }
    if (
      (typeof candidate.url !== "string" || candidate.url.length === 0) &&
      typeof candidate.image !== "string" &&
      !(candidate.image instanceof URL)
    ) {
      continue;
    }
    imageParts.push({
      type,
      mediaType: candidate.mediaType,
      url: typeof candidate.url === "string" ? candidate.url : undefined,
      image:
        typeof candidate.image === "string" || candidate.image instanceof URL
          ? candidate.image
          : undefined,
      filename:
        typeof candidate.filename === "string" ? candidate.filename : undefined,
    });
  }
  return imageParts;
}

function getImagePartUrl(part: MessageFilePart): string {
  if (part.url) return part.url;
  return String(part.image);
}

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
  const imageParts = getImageParts(message);
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
          {imageParts.length > 0 ? (
            <div className="mb-2 grid gap-2">
              {imageParts.map((part, index) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={`${getImagePartUrl(part)}-${index}`}
                  src={getImagePartUrl(part)}
                  alt={part.filename ?? "Attached image"}
                  className="max-h-52 rounded-lg object-cover"
                />
              ))}
            </div>
          ) : null}
          {displayText}
          {isStreaming && !displayText && isUser && <ChatMessageLoading />}
          {showsPendingAssistant && <BookFlip />}
        </ChatMessageBubble>
        {isFailed && <ChatMessageError onRetry={onRetry} />}
      </ChatMessageContent>
    </ChatMessage>
  );
});
