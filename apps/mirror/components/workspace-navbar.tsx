"use client";

import { type ReactElement } from "react";
import { useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@feel-good/utils/cn";
import { useProfileRouteData } from "@/app/[username]/_providers/profile-route-data-context";
import { ToolbarSlotTarget } from "@/components/workspace-toolbar-slot";
import { ProfileTabs } from "@/features/profile-tabs/components/profile-tabs";
import {
  isProfileTabKind,
  PROFILE_TAB_DEFAULT_KIND,
  type ProfileTabKind,
} from "@/features/profile-tabs/types";

type WorkspaceNavbarProps = {
  className?: string;
};

export function WorkspaceNavbar({
  className,
}: WorkspaceNavbarProps): ReactElement {
  const segments = useSelectedLayoutSegments();
  const { profile } = useProfileRouteData();
  const currentKind: ProfileTabKind = isProfileTabKind(segments[0])
    ? segments[0]
    : PROFILE_TAB_DEFAULT_KIND;

  return (
    <nav
      className={cn(
        "relative z-20 flex h-9.5 shrink-0 items-center gap-2 bg-background px-4 md:gap-4.5",
        className,
      )}
    >
      <div className="min-w-0 shrink-0 overflow-x-auto pt-px">
        <ProfileTabs username={profile.username} currentKind={currentKind} />
      </div>
      <ToolbarSlotTarget />
    </nav>
  );
}
