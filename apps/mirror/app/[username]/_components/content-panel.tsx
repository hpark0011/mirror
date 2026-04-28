"use client";

import { type ReactNode, useEffect, useState } from "react";
import { type ContentRouteState, ScrollRootProvider } from "@/features/content";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import {
  ToolbarSlotProvider,
  ToolbarSlotTarget,
} from "@/components/workspace-toolbar-slot";
import { useProfileNavigationEffects } from "@/hooks/use-profile-navigation-effects";
import { markContentPanelRendered } from "@/lib/perf/content-panel-open";

// Bottom padding reserved inside the scroll container so content clears the
// chat input / sticky footer that floats above it. Pairs with the chat input
// height — bump this if that surface grows.
const SCROLL_FOOTER_PAD_PX = 64;
// Height of the top fade-mask gradient that softens content scrolling under
// the WorkspaceNavbar + ToolbarSlotTarget. Pairs with the navbar/toolbar
// stack — adjust if either grows or the fade should reach further.
const FADE_MASK_HEIGHT_PX = 40;

type ContentPanelProps = {
  routeState: ContentRouteState | null;
  children: ReactNode;
};

export function ContentPanel({
  routeState,
  children,
}: ContentPanelProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  useProfileNavigationEffects(scrollRoot, routeState);

  useEffect(() => {
    if (typeof performance === "undefined") return;
    const hasStart =
      performance.getEntriesByName("content-panel:open:start", "mark").length >
        0;
    const hasRendered =
      performance.getEntriesByName("content-panel:open:rendered", "mark")
        .length > 0;
    if (!hasStart || hasRendered) return;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        markContentPanelRendered();
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [routeState, children]);

  return (
    <ToolbarSlotProvider>
      <div className="relative flex h-full min-w-0 flex-col">
        <WorkspaceNavbar />
        <ToolbarSlotTarget />
        <div className="flex-1 min-h-0 *:h-full relative">
          <div
            className="w-full absolute top-0 bg-linear-to-b to-transparent z-10 from-background"
            style={{ maxHeight: FADE_MASK_HEIGHT_PX }}
          />
          <div
            ref={setScrollRoot}
            className="overflow-y-auto h-full pt-0"
            style={{ paddingBottom: SCROLL_FOOTER_PAD_PX }}
          >
            <ScrollRootProvider value={scrollRoot}>
              {children}
            </ScrollRootProvider>
          </div>
        </div>
      </div>
    </ToolbarSlotProvider>
  );
}
