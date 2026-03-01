"use client";

import { useSmoothText } from "@convex-dev/agent/react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@feel-good/ui/primitives/avatar";
import { cn } from "@feel-good/utils/cn";

type ChatMessageProps = {
  role: "user" | "assistant";
  text: string;
  isStreaming: boolean;
  avatarUrl?: string | null;
  profileName?: string;
};

export function ChatMessage({
  role,
  text,
  isStreaming,
  avatarUrl,
  profileName,
}: ChatMessageProps) {
  const isUser = role === "user";

  // Smooth text animation for streaming assistant messages
  const [smoothText] = useSmoothText(text, {
    startStreaming: isStreaming,
  });

  const displayText = isStreaming ? smoothText : text;

  const initials = profileName
    ? profileName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AI";

  return (
    <div
      className={cn(
        "flex gap-2.5 max-w-[85%]",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto",
      )}
    >
      {!isUser && (
        <Avatar className="size-7 shrink-0 mt-1">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={profileName ?? ""} />}
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          "whitespace-pre-wrap break-words",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {displayText}
        {isStreaming && !displayText && (
          <span className="inline-flex gap-1">
            <span className="size-1.5 rounded-full bg-current animate-pulse" />
            <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
            <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  );
}
