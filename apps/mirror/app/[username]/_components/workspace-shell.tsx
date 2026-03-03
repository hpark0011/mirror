"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import type { RouteMode } from "@/hooks/use-profile-navigation-effects";
import { DesktopWorkspace } from "./desktop-workspace";
import { MobileWorkspace } from "./mobile-workspace";
import { ContentPanel } from "./content-panel";

type WorkspaceShellProps = {
  interaction: ReactNode;
  children: ReactNode;
};

export function WorkspaceShell({ interaction, children }: WorkspaceShellProps) {
  const isMobile = useIsMobile();
  const segment = useSelectedLayoutSegment();
  const routeMode: RouteMode = segment === "chat"
    ? "chat"
    : segment
    ? "detail"
    : "list";

  if (isMobile) {
    return (
      <MobileWorkspace routeMode={routeMode} interaction={interaction}>
        {children}
      </MobileWorkspace>
    );
  }

  return (
    <DesktopWorkspace
      interaction={interaction}
    >
      {routeMode === "chat"
        ? children
        : <ContentPanel routeMode={routeMode}>{children}</ContentPanel>}
    </DesktopWorkspace>
  );
}
