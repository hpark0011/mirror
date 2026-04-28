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
import { CONTENT_PANEL_ID } from "@/app/[username]/_components/workspace-panels";
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
  const showContentPanelToggle = chrome?.showContentPanelToggle ?? false;

  return (
    <nav
      className={cn(
        "z-10 flex h-11 items-end justify-between gap-2 md:px-4 px-1.5 relative border-b border-border-subtle pr-5",
        className,
      )}
    >
      <div className="flex items-end gap-2 md:gap-1">
        {backHref
          ? (
            <div className="h-full flex items-center pb-1.5">
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
        <ProfileTabs
          username={profile.username}
          currentKind={currentKind}
          isOwner={isOwner}
        />
      </div>

      {showContentPanelToggle && chrome
        ? (
          <div className="h-full flex items-center">
            <IconButton
              onClick={chrome.toggleContentPanel}
              aria-controls={CONTENT_PANEL_ID}
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
              <SidebarTrigger
                isOpen={!chrome.isContentPanelCollapsed}
                align="right"
              />
            </IconButton>
          </div>
        )
        : null}
    </nav>
  );
}
