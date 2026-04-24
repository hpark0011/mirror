"use client";

import { cn } from "@feel-good/utils/cn";
import { IconButton } from "@feel-good/ui/components/icon-button";
import { SidebarTrigger } from "@feel-good/ui/components/sidebar-trigger";
import { ProfileTabs } from "@/features/profile-tabs/components/profile-tabs";
import {
  isProfileTabKind,
  PROFILE_TAB_DEFAULT_KIND,
  type ProfileTabKind,
} from "@/features/profile-tabs/types";
import { useProfileRouteData } from "@/app/[username]/_providers/profile-route-data-context";
import { useOptionalWorkspaceChrome } from "@/app/[username]/_providers/workspace-chrome-context";
import { useSelectedLayoutSegments } from "next/navigation";

type WorkspaceNavbarProps = {
  className?: string;
};

export function WorkspaceNavbar({ className }: WorkspaceNavbarProps) {
  const segments = useSelectedLayoutSegments();
  const { profile, isOwner } = useProfileRouteData();
  const chrome = useOptionalWorkspaceChrome();
  const currentKind: ProfileTabKind = isProfileTabKind(segments[0])
    ? segments[0]
    : PROFILE_TAB_DEFAULT_KIND;

  return (
    <nav
      className={cn(
        "z-10 flex h-12 items-end gap-2 px-4 relative border-b border-border-subtle justify-between",
        className,
      )}
    >
      <div className="flex gap-2 h-full items-end">
        <ProfileTabs
          username={profile.username}
          currentKind={currentKind}
          isOwner={isOwner}
        />
      </div>
      {chrome
        ? (
          <div className="h-full flex items-center">
            <IconButton
              onClick={chrome.toggleContentPanel}
              aria-controls={chrome.contentPanelId}
              aria-expanded={!chrome.isContentPanelCollapsed}
              aria-label={chrome.isContentPanelCollapsed
                ? "Expand content panel"
                : "Collapse content panel"}
              tooltip={chrome.isContentPanelCollapsed
                ? "Expand content panel"
                : "Collapse content panel"}
              variant="wrapper"
              className="w-auto"
            >
              <SidebarTrigger isOpen={!chrome.isContentPanelCollapsed} />
            </IconButton>
          </div>
        )
        : null}
    </nav>
  );
}
