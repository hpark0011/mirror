"use client";

import { MirrorAvatar } from "@/components/mirror-avatar";
import { useProfileRouteData } from "../_providers/profile-route-data-context";
import { useOptionalWorkspaceChrome } from "../_providers/workspace-chrome-context";

export function CollapsedProfileAvatarButton() {
  const chrome = useOptionalWorkspaceChrome();
  const { profile } = useProfileRouteData();

  if (!chrome || !chrome.isInteractionPanelCollapsed) return null;

  return (
    <button
      type="button"
      onClick={chrome.toggleInteractionPanel}
      aria-controls={chrome.interactionPanelId}
      aria-expanded={false}
      aria-label="Expand profile panel"
      className="absolute bottom-4.5 left-4.5 z-30 rounded-t-full cursor-pointer flex flex-col items-center shadow-avatar-shadow"
    >
      <MirrorAvatar
        className="shrink-0 size-12"
        avatarUrl={profile.avatarUrl}
        profileName={profile.name}
      />
    </button>
  );
}
