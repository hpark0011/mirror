"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { MirrorAvatar } from "@/components/mirror-avatar";
import { useProfileRouteData } from "../_providers/profile-route-data-context";
import { useOptionalWorkspaceChrome } from "../_providers/workspace-chrome-context";
import { INTERACTION_PANEL_ID } from "./workspace-panels";

export function CollapsedProfileAvatarButton() {
  const chrome = useOptionalWorkspaceChrome();
  const { profile } = useProfileRouteData();

  if (!chrome || !chrome.isInteractionPanelCollapsed) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={chrome.toggleInteractionPanel}
          aria-controls={INTERACTION_PANEL_ID}
          aria-expanded={false}
          aria-label={`Chat with ${profile.username}`}
          className="absolute bottom-4.5 left-4.5 z-30 rounded-t-full cursor-pointer flex flex-col items-center shadow-avatar-shadow hover:shadow-xs transition-all duration-200 ease-in-out"
        >
          <MirrorAvatar
            className="shrink-0 size-14 md:size-16"
            avatarUrl={profile.avatarUrl}
            profileName={profile.name}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>Chat with {profile.username}</TooltipContent>
    </Tooltip>
  );
}
