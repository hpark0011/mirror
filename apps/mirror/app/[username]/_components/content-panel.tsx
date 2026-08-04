"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import { ToolbarSlotProvider } from "@/components/workspace-toolbar-slot";
import { type ContentRouteState, ScrollRootProvider } from "@/features/content";
import { useProfileNavigationEffects } from "@/hooks/use-profile-navigation-effects";

type ContentPanelProps = {
  routeState: ContentRouteState | null;
  children: ReactNode;
};

export function ContentPanel({
  routeState,
  children,
}: ContentPanelProps): ReactElement {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  useProfileNavigationEffects(scrollRoot, routeState);

  return (
    <ToolbarSlotProvider>
      <div className="relative flex h-full min-w-0 flex-col">
        <WorkspaceNavbar />
        <div className="flex-1 min-h-0 *:h-full relative">
          <div ref={setScrollRoot} className="overflow-y-auto h-full pt-0">
            <ScrollRootProvider value={scrollRoot}>
              {children}
            </ScrollRootProvider>
          </div>
        </div>
      </div>
    </ToolbarSlotProvider>
  );
}
