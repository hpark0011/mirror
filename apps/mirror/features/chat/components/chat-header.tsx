"use client";

import { Button } from "@feel-good/ui/primitives/button";
import { Icon } from "@feel-good/ui/components/icon";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@feel-good/ui/primitives/avatar";
import { cn } from "@feel-good/utils/cn";

type ChatHeaderProps = {
  profileName: string;
  avatarUrl: string | null;
  onBack: () => void;
  onNewConversation?: () => void;
};

export function ChatHeader({
  profileName,
  avatarUrl,
  onBack,
  onNewConversation,
}: ChatHeaderProps) {
  const initials = profileName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        "border-b border-border-subtle",
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onBack}
        className="shrink-0"
      >
        <Icon name="ArrowLeftLineIcon" className="size-5" />
      </Button>

      <Avatar className="size-8 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={profileName} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <span className="text-sm font-medium truncate flex-1">
        {profileName}
      </span>

      {onNewConversation && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNewConversation}
          className="shrink-0"
        >
          <Icon name="PlusIcon" className="size-5" />
        </Button>
      )}
    </div>
  );
}
