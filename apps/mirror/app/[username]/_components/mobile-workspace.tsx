"use client";

import { useState, type ReactNode } from "react";
import { MobileProfileLayout } from "@/features/profile";
import { ScrollRootProvider } from "@/features/articles";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import {
  ToolbarSlotProvider,
  ToolbarSlotTarget,
} from "@/components/workspace-toolbar-slot";
import {
  useProfileNavigationEffects,
  type RouteMode,
} from "@/hooks/use-profile-navigation-effects";

type MobileWorkspaceProps = {
  routeMode: RouteMode;
  interaction: ReactNode;
  children: ReactNode;
};

export function MobileWorkspace({
  routeMode,
  interaction,
  children,
}: MobileWorkspaceProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  useProfileNavigationEffects(scrollRoot, routeMode);

  if (routeMode === "chat") {
    return <main className="h-screen">{interaction}</main>;
  }

  return (
    <main className="h-screen">
      <ToolbarSlotProvider>
        <WorkspaceNavbar className="fixed top-0 inset-x-0" />
        <MobileProfileLayout
          profile={
            <div className="relative h-full flex flex-col">{interaction}</div>
          }
          content={() => (
            <div className="flex h-full min-h-0 flex-col">
              <ToolbarSlotTarget />
              <div className="flex-1 min-h-0 *:h-full">
                <div
                  ref={setScrollRoot}
                  className="overflow-y-auto overscroll-y-contain h-full px-3"
                >
                  <ScrollRootProvider value={scrollRoot}>
                    {children}
                  </ScrollRootProvider>
                </div>
              </div>
            </div>
          )}
        />
      </ToolbarSlotProvider>
    </main>
  );
}
