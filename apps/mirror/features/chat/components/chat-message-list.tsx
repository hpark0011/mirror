"use client";

import type { UIMessage } from "@convex-dev/agent/react";
import { ArrowDownIcon } from "@feel-good/icons";
import { Button } from "@feel-good/ui/primitives/button";
import { cn } from "@feel-good/utils/cn";
import * as React from "react";
import { ArcSphere } from "../../../components/animated-geometries/arc-sphere";
import { WireframeSphere } from "../../../components/animated-geometries/wireframe-sphere";
import { ChatMessageItem } from "./chat-message-item";

const AUTO_SCROLL_THRESHOLD_PX = 96;

function getDistanceFromBottom(container: HTMLDivElement) {
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function isNearBottom(container: HTMLDivElement) {
  return getDistanceFromBottom(container) <= AUTO_SCROLL_THRESHOLD_PX;
}

/* Internal building-block components — not exported. */

/** Full-height centered loading state shown while the first page loads. */
function ChatMessageLoadingState({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-message-loading-state"
      className={cn("flex-1 flex items-center justify-center pb-20", className)}
      {...props}
    >
      <ArcSphere />
    </div>
  );
}

/** Greeting shown when no messages exist yet. */
function ChatMessageEmptyState({
  className,
  profileName,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { profileName: string }) {
  return (
    <div
      data-slot="chat-message-empty-state"
      className={cn(
        "flex-1 flex flex-col items-center justify-center px-6 gap-8",
        className,
      )}
      {...props}
    >
      <WireframeSphere />
      <div className="flex flex-col">
        <div className="text-center leading-[1.2] pb-20 text-lg">
          <p>
            Hi! I&apos;m {profileName}&apos;s digital clone.
          </p>
          <p>
            Ask me anything about work and ideas.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Top-of-list loading indicator during infinite scroll. */
function ChatMessageLoadingMore({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-message-loading-more"
      className={cn("flex justify-center py-2", className)}
      {...props}
    >
      <ArcSphere />
    </div>
  );
}

/** Scrollable container for the message list. */
function ChatMessageScrollArea({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-message-scroll-area"
      className={cn(
        "flex-1 overflow-y-auto overscroll-y-contain px-4 pt-18 pb-[160px]",
        className,
      )}
      {...props}
    />
  );
}

/* Composed exports — consumed by chat-thread. */

type ChatMessageListProps = {
  messages: UIMessage[];
  avatarUrl: string | null;
  profileName: string;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: (numItems: number) => void;
  onRetry?: () => void;
  sendAnimationKey: string | null;
};

function ChatMessageList({
  messages,
  avatarUrl,
  profileName,
  status,
  loadMore,
  onRetry,
  sendAnimationKey,
}: ChatMessageListProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const messageStackRef = React.useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = React.useRef(true);
  const resizeFrameRef = React.useRef<number | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = React.useState(true);

  const lastKey = messages.at(-1)?.key ?? null;

  const syncPinnedToBottom = React.useCallback(
    (nextPinnedToBottom: boolean) => {
      pinnedToBottomRef.current = nextPinnedToBottom;
      setIsPinnedToBottom((currentPinnedToBottom) =>
        currentPinnedToBottom === nextPinnedToBottom
          ? currentPinnedToBottom
          : nextPinnedToBottom
      );
    },
    [],
  );

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const container = scrollContainerRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    },
    [],
  );

  React.useEffect(() => {
    if (messages.length === 0) {
      syncPinnedToBottom(true);
    }
  }, [messages.length, syncPinnedToBottom]);

  // Auto-scroll when new messages appear
  React.useEffect(() => {
    if (!lastKey || !pinnedToBottomRef.current) return;
    scrollToBottom("auto");
  }, [lastKey, scrollToBottom]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    function handleScroll() {
      if (!container) return;
      syncPinnedToBottom(isNearBottom(container));

      if (status === "CanLoadMore" && container.scrollTop < 100) {
        loadMore(20);
      }
    }

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages.length, status, loadMore, syncPinnedToBottom]);

  React.useEffect(() => {
    const messageStack = messageStackRef.current;
    if (!messageStack || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (!pinnedToBottomRef.current) return;

      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;

        if (!pinnedToBottomRef.current) return;
        scrollToBottom("auto");
      });
    });

    observer.observe(messageStack);

    return () => {
      observer.disconnect();

      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [messages.length, scrollToBottom]);

  if (status === "LoadingFirstPage") {
    return <ChatMessageLoadingState />;
  }

  if (messages.length === 0) {
    return <ChatMessageEmptyState profileName={profileName} />;
  }

  return (
    <div className="relative flex flex-1 min-h-0">
      <ChatMessageScrollArea ref={scrollContainerRef}>
        {status === "LoadingMore" && <ChatMessageLoadingMore />}

        <div
          ref={messageStackRef}
          className="flex flex-col gap-3 mx-auto max-w-5xl"
        >
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
                animateSend={message.key === sendAnimationKey}
              />
            ))}
        </div>
      </ChatMessageScrollArea>

      {!isPinnedToBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 flex justify-center px-4 mb-2">
          <Button
            type="button"
            variant="primary"
            size="icon"
            data-slot="chat-message-scroll-to-bottom"
            aria-label="Scroll to latest message"
            className="pointer-events-auto shadow-xl rounded-full"
            onClick={() => scrollToBottom("smooth")}
          >
            <ArrowDownIcon className="size-6 text-primary-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
}

export { ChatMessageList };
export type { ChatMessageListProps };
