"use client";

import type { Conversation } from "../types";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import { cn } from "@feel-good/utils/cn";

type ConversationListProps = {
  conversations: Conversation[];
  activeConversationId: Id<"conversations"> | null;
  onSelect: (conversationId: Id<"conversations">) => void;
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 px-4">
        <p className="text-sm text-muted-foreground">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {conversations.map((conversation) => {
        const isActive = conversation._id === activeConversationId;

        return (
          <button
            key={conversation._id}
            type="button"
            onClick={() => onSelect(conversation._id)}
            className={cn(
              "flex flex-col gap-0.5 px-4 py-3 text-left",
              "transition-colors hover:bg-muted/50",
              isActive && "bg-muted",
            )}
          >
            <span className="text-sm font-medium truncate">
              {conversation.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(conversation._creationTime)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
