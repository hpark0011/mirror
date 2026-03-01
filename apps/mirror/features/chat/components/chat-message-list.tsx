"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "@convex-dev/agent/react";
import { ChatMessage } from "./chat-message";
import { cn } from "@feel-good/utils/cn";

type ChatMessageListProps = {
  messages: UIMessage[];
  avatarUrl: string | null;
  profileName: string;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: (numItems: number) => void;
};

export function ChatMessageList({
  messages,
  avatarUrl,
  profileName,
  status,
  loadMore,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevLastKeyRef = useRef<string | undefined>(undefined);

  // Auto-scroll only on tail appends (new messages), not history prepends
  const lastKey = messages.at(-1)?.key;
  useEffect(() => {
    if (lastKey && lastKey !== prevLastKeyRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLastKeyRef.current = lastKey;
  }, [lastKey]);

  // Load more on scroll to top
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || status !== "CanLoadMore") return;

    function handleScroll() {
      if (container!.scrollTop < 100) {
        loadMore(20);
      }
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [status, loadMore]);

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/40 animate-pulse" />
          <span className="size-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
          <span className="size-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <p className={cn("text-sm text-muted-foreground text-center")}>
          Send a message to start a conversation with {profileName}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4"
    >
      {status === "LoadingMore" && (
        <div className="flex justify-center py-2">
          <div className="flex gap-1.5">
            <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
            <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
            <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {messages
          .filter(
            (m): m is typeof m & { role: "user" | "assistant" } =>
              m.role === "user" || m.role === "assistant",
          )
          .map((message) => (
            <ChatMessage
              key={message.key}
              role={message.role}
              text={message.text}
              isStreaming={message.status === "streaming"}
              avatarUrl={message.role === "assistant" ? avatarUrl : undefined}
              profileName={
                message.role === "assistant" ? profileName : undefined
              }
            />
          ))}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
