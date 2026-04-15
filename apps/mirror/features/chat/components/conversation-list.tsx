"use client";

import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import { cn } from "@feel-good/utils/cn";
import * as React from "react";
import type { Conversation } from "../types";
import { formatRelativeTime } from "../utils/format-relative-time";
import { WireframeSphere } from "../../../components/animated-geometries/wireframe-sphere";

/* Internal building-block components — not exported. */

function ConversationListEmpty({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  return (
    <div
      data-slot="conversation-list-empty"
      className="flex items-center justify-center pb-8 px-4 h-full relative"
    >
      <div
        className={cn(
          "flex flex-col items-center",
          "text-2xl text-center font-medium z-10 leading-[1.1] capitalize",
        )}
      >
        <p>
          {isAuthenticated
            ? "No conversations yet."
            : "Sign up to save your conversations."}
        </p>
      </div>
      <div className="absolute flex flex-col items-center justify-center">
        <WireframeSphere />
      </div>
    </div>
  );
}

function ConversationListItem({
  className,
  isActive,
  ...props
}: React.ComponentProps<"button"> & { isActive?: boolean }) {
  return (
    <button
      data-slot="conversation-list-item"
      data-active={isActive || undefined}
      type="button"
      className={cn(
        "flex gap-4 px-4 py-0 text-left justify-between items-baseline",
        "transition-colors hover:bg-muted/50 cursor-pointer group-hover/list:text-muted-foreground hover:text-secondary-foreground",
        isActive && "bg-muted/50",
        className,
      )}
      {...props}
    />
  );
}

function ConversationListItemTitle({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="conversation-list-item-title"
      className={cn("text-md font-medium truncate max-w-xl", className)}
      {...props}
    />
  );
}

function ConversationListItemTimestamp({
  className,
  timestamp,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { timestamp: number }) {
  return (
    <span
      data-slot="conversation-list-item-timestamp"
      className={cn(
        "text-[15px] text-muted-foreground whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {formatRelativeTime(timestamp)}
    </span>
  );
}

/* Composed exports — consumed by profile-shell. */

type ConversationListProps = {
  conversations: Conversation[];
  activeConversationId: Id<"conversations"> | null;
  onSelect: (id: Id<"conversations">) => void;
  isAuthenticated: boolean;
};

function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  isAuthenticated,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return <ConversationListEmpty isAuthenticated={isAuthenticated} />;
  }

  return (
    <div
      data-slot="conversation-list"
      className="flex flex-col group/list"
    >
      {conversations.map((conversation) => (
        <ConversationListItem
          key={conversation._id}
          isActive={conversation._id === activeConversationId}
          onClick={() => onSelect(conversation._id)}
        >
          <ConversationListItemTitle>
            {conversation.title}
          </ConversationListItemTitle>
          <ConversationListItemTimestamp
            timestamp={conversation._creationTime}
          />
        </ConversationListItem>
      ))}
    </div>
  );
}

export { ConversationList };
export type { ConversationListProps };
