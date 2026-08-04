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
  const { profile } = useProfileRouteData();
  const currentKind: ProfileTabKind = isProfileTabKind(segments[0])
    ? segments[0]
    : PROFILE_TAB_DEFAULT_KIND;

  return (
    <nav
      className={cn(
        "z-10 flex h-9.5 items-center justify-between gap-2 md:gap-4.5 px-5 md:pr-4 pr-3.5 md:pl-3.5 pl-0 relative ",
        className,
      )}
    >
      <div className="flex items-center justify-start md:justify-center gap-2 w-full">
        <div className="w-full pt-px">
          <ProfileTabs username={profile.username} currentKind={currentKind} />
        </div>
      </div>
    </nav>
  );
}
