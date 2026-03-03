"use client";

import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { Icon } from "@feel-good/ui/components/icon";
import { cn } from "@feel-good/utils/cn";
import { MirrorAvatar } from "@/components/mirror-avatar";

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
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-start px-4 pt-2",
      )}
    >
      <div className="mt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={onBack}
              className="shrink-0 rounded-full"
            >
              <Icon name="ArrowBackwardIcon" className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Profile</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col items-center relative">
        <MirrorAvatar
          className="shrink-0"
          avatarUrl={avatarUrl}
          profileName={profileName}
        />

        <span className="text-[13px] font-medium truncate px-2.5 py-0.5 bg-card border border-gray-1 rounded-xl shadow-xl top-[-4px] relative min-w-[48px]">
          {profileName}
        </span>
      </div>

      <div className="mt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={onNewConversation}
              className="shrink-0 rounded-full"
            >
              <Icon name="PlusIcon" className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New chat</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
