"use client";

import { ThemeToggleButton } from "@feel-good/features/theme/components";
import { cn } from "@feel-good/utils/cn";
import { ContentKindTabs, getContentRouteState } from "@/features/content";
import { useProfileRouteData } from "@/app/[username]/_providers/profile-route-data-context";
import { useSelectedLayoutSegments } from "next/navigation";

type WorkspaceNavbarProps = {
  className?: string;
};

export function WorkspaceNavbar({ className }: WorkspaceNavbarProps) {
  const segments = useSelectedLayoutSegments();
  const { profile } = useProfileRouteData();
  const routeState = getContentRouteState(segments);

  return (
    <nav
      className={cn(
        "z-10 flex h-8 items-center justify-between gap-2 px-4 relative mt-4",
        className,
      )}
    >
      <div className="bg-border-subtle w-full h-px absolute left-0 bottom-0" />
      <ContentKindTabs
        username={profile.username}
        currentKind={routeState.kind}
      />
      <div className="mb-4.5">
        <ThemeToggleButton />
      </div>
    </nav>
  );
}
