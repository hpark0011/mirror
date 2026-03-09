"use client";

import * as React from "react";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { Icon, type IconName } from "@feel-good/ui/components/icon";
import { cn } from "@feel-good/utils/cn";
import { MirrorAvatar } from "@/components/mirror-avatar";

/* Internal building-block components — not exported. */

/** Tooltip-wrapped icon button used for new-chat action. */
function ChatHeaderAction({
  tooltip,
  icon,
  className,
  ...props
}:
  & {
    tooltip: string;
    icon: IconName;
  }
  & Omit<
    React.ComponentProps<typeof Button>,
    "variant" | "size" | "children"
  >) {
  return (
    <div data-slot="chat-header-action" className="mt-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className={cn("shrink-0 rounded-full", className)}
            {...props}
          >
            <Icon name={icon} className="size-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Name badge displayed below the avatar. */
function ChatHeaderProfileName({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="chat-header-profile-name"
      className={cn(
        "text-[13px] font-medium truncate px-2.5 py-0.5 bg-card border border-gray-1 dark:border-gray-4 rounded-xl shadow-xl top-[-4px] relative min-w-[48px] group-hover:shadow-sm transition-all ease-in-out duration-200 group-hover:bg-gray-1",
        className,
      )}
      {...props}
    />
  );
}

/** Center column with avatar and name badge — calls onClick callback. */
function ChatHeaderProfile({
  avatarUrl,
  profileName,
  className,
  onClick,
}: {
  avatarUrl: string | null;
  profileName: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      data-slot="chat-header-profile"
      className={cn(
        "flex flex-col items-center relative",
        className,
      )}
    >
      <div
        className="flex flex-col items-center relative cursor-pointer group"
        onClick={onClick}
      >
        <MirrorAvatar
          className="shrink-0"
          avatarUrl={avatarUrl}
          profileName={profileName}
        />
        <ChatHeaderProfileName>{profileName}</ChatHeaderProfileName>
      </div>
    </button>
  );
}

/* Composed exports — consumed by chat-thread. */

type ChatHeaderProps = {
  profileName: string;
  avatarUrl: string | null;
  onProfileClick?: () => void;
  onNewConversation?: () => void;
  onOpenConversationList?: () => void;
};

function ChatHeader({
  profileName,
  avatarUrl,
  onProfileClick,
  onNewConversation,
  onOpenConversationList,
}: ChatHeaderProps) {
  return (
    <div
      data-slot="chat-header"
      className="grid grid-cols-[auto_1fr_auto] items-start px-3 pt-2"
    >
      <ChatHeaderAction
        tooltip="Conversations"
        icon="ListBulletIcon"
        onClick={onOpenConversationList}
      />

      <ChatHeaderProfile
        avatarUrl={avatarUrl}
        profileName={profileName}
        onClick={onProfileClick}
      />

      <ChatHeaderAction
        tooltip="New chat"
        icon="PlusIcon"
        onClick={onNewConversation}
      />
    </div>
  );
}

export { ChatHeader };
export type { ChatHeaderProps };
