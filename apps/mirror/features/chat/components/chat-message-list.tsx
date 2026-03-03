"use client";

import type { UIMessage } from "@convex-dev/agent/react";
import { useEffect, useRef } from "react";
import { ChatMessageItem } from "./chat-message-item";

type ChatMessageListProps = {
  messages: UIMessage[];
  avatarUrl: string | null;
  profileName: string;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: (numItems: number) => void;
  onRetry?: () => void;
};

export function ChatMessageList({
  messages,
  avatarUrl,
  profileName,
  status,
  loadMore,
  onRetry,
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
        <div className="flex gap-1">
          <span className="size-1 rounded-full bg-muted-foreground/40 animate-pulse" />
          <span className="size-1 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
          <span className="size-1 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Hi! I&apos;m {profileName}&apos;s digital clone.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Ask me anything about their work and ideas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto overscroll-y-contain px-4 pt-18 pb-[160px]"
    >
      {status === "LoadingMore" && (
        <div className="flex justify-center py-2">
          <div className="flex gap-1">
            <span className="size-1 rounded-full bg-muted-foreground/40 animate-pulse" />
            <span className="size-1 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
            <span className="size-1 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
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
            <ChatMessageItem
              key={message.key}
              message={message}
              avatarUrl={message.role === "assistant" ? avatarUrl : null}
              profileName={profileName}
              onRetry={message.status === "failed" ? onRetry : undefined}
            />
          ))}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
