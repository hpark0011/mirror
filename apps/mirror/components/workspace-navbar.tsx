"use client";

import { cn } from "@feel-good/utils/cn";
import { ProfileTabs } from "@/features/profile-tabs/components/profile-tabs";
import {
  isProfileTabKind,
  PROFILE_TAB_DEFAULT_KIND,
  type ProfileTabKind,
} from "@/features/profile-tabs/types";
import { useProfileRouteData } from "@/app/[username]/_providers/profile-route-data-context";
import { useSelectedLayoutSegments } from "next/navigation";

type WorkspaceNavbarProps = {
  className?: string;
};

export function WorkspaceNavbar({ className }: WorkspaceNavbarProps) {
  const segments = useSelectedLayoutSegments();
  const { profile, isOwner } = useProfileRouteData();
  const currentKind: ProfileTabKind = isProfileTabKind(segments[0])
    ? segments[0]
    : PROFILE_TAB_DEFAULT_KIND;

  return (
    <nav
      className={cn(
        "z-10 flex h-12 items-end gap-2 px-4 relative border-b border-border-subtle",
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
    </nav>
  );
}
