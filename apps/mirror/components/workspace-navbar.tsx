"use client";

import Link from "next/link";
import { cn } from "@feel-good/utils/cn";
import { ProfileTabs } from "@/features/profile-tabs/components/profile-tabs";
import {
  isProfileTabKind,
  PROFILE_TAB_DEFAULT_KIND,
  type ProfileTabKind,
} from "@/features/profile-tabs/types";
import { useProfileRouteData } from "@/app/[username]/_providers/profile-route-data-context";
import { useSelectedLayoutSegments } from "next/navigation";
import { useOptionalWorkspaceChrome } from "@/app/[username]/_providers/workspace-chrome-context";
import { INTERACTION_PANEL_ID } from "@/app/[username]/_components/workspace-panels";
import { Icon } from "@feel-good/ui/components/icon";
import { IconButton } from "@feel-good/ui/components/icon-button";
import { SidebarTrigger } from "@feel-good/ui/components/sidebar-trigger";

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
  const backHref = chrome?.backHref;
  const showProfilePanelToggle = chrome?.showProfilePanelToggle ?? false;

  return (
    <nav
      className={cn(
        "z-10 flex h-9.5 items-center justify-between gap-2 md:gap-4.5 px-5 md:pl-3.5 pl-0 relative",
        className,
      )}
    >
      <div className="max-w-none w-fit h-full">
        {showProfilePanelToggle && chrome
          ? (
            <div className="h-full flex items-center">
              <IconButton
                onClick={chrome.toggleInteractionPanel}
                aria-controls={INTERACTION_PANEL_ID}
                aria-expanded={!chrome.isInteractionPanelCollapsed}
                aria-label={chrome.isInteractionPanelCollapsed
                  ? "Expand profile panel"
                  : "Collapse profile panel"}
                tooltip={chrome.isInteractionPanelCollapsed
                  ? "Expand profile panel"
                  : "Collapse profile panel"}
                variant="wrapper"
                className="w-auto"
              >
                <SidebarTrigger
                  isOpen={!chrome.isInteractionPanelCollapsed}
                  align="left"
                />
              </IconButton>
            </div>
          )
          : null}
      </div>
      <div className="flex items-center justify-start md:justify-center gap-2 w-full">
        {backHref
          ? (
            <div className="h-full flex items-center">
              <IconButton
                asChild
                aria-label="Back to profile"
                tooltip="Back to profile"
                variant="ghost"
              >
                <Link href={backHref}>
                  <Icon name="ArrowBackwardIcon" />
                </Link>
              </IconButton>
            </div>
          )
          : null}
        <div className="w-full pt-px">
          <ProfileTabs
            username={profile.username}
            currentKind={currentKind}
            isOwner={isOwner}
          />
        </div>
      </div>
    </nav>
  );
}
