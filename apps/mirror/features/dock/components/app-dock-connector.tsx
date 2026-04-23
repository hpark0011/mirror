"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { DockIcon } from "@feel-good/features/dock/components";
import {
  useDockConfig,
  useDockVisibility,
} from "@feel-good/features/dock/hooks";
import { DockProvider, useDock } from "@feel-good/features/dock/providers";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { cn } from "@feel-good/utils/cn";
import { APP_DOCK_CONFIG } from "../lib/dock-config";
import { InteractionPanelToggle } from "./interaction-panel-toggle";

function AppDockContent() {
  const router = useRouter();
  const { state, setActiveAppId } = useDock();
  const { isVisible, handlers } = useDockVisibility();
  const { sortedApps } = useDockConfig();

  const handleAppClick = useCallback(
    (appId: string, route: string) => {
      setActiveAppId(appId);
      router.push(route);
    },
    [router, setActiveAppId],
  );

  return (
    <div
      data-slot="dock-root"
      className="fixed inset-y-0 left-0 z-20"
    >
      <div
        className="absolute inset-y-0 left-0 w-[72px]"
        onMouseEnter={handlers.onActivationZoneEnter}
        onMouseLeave={handlers.onActivationZoneLeave}
      />
      <nav
        role="navigation"
        aria-label="App navigation"
        data-slot="dock-container"
        data-state={isVisible ? "visible" : "hidden"}
        onMouseEnter={handlers.onDockEnter}
        onMouseLeave={handlers.onDockLeave}
        className={cn(
          "fixed top-1/2 left-2 -translate-y-1/2",
          "flex flex-col items-center gap-0.5 p-1",
          "bg-background/80 backdrop-blur-lg",
          "border border-border/80 rounded-[16px]",
          "transition-transform duration-300 ease-out",
          isVisible ? "translate-x-0" : "-translate-x-[calc(100%+16px)]",
        )}
      >
        {sortedApps.map((app) => {
          const isActive = state.activeAppId === app.id;
          return (
            <Tooltip key={app.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="button"
                  aria-pressed={isActive}
                  aria-label={app.name}
                  data-slot="dock-item"
                  onClick={() => handleAppClick(app.id, app.route)}
                  className={cn(
                    "relative cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <DockIcon icon={app.icon} isActive={isActive} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={4}>
                {app.name}
              </TooltipContent>
            </Tooltip>
          );
        })}
        <InteractionPanelToggle />
      </nav>
    </div>
  );
}

export function AppDockConnector() {
  return (
    <DockProvider config={APP_DOCK_CONFIG}>
      <AppDockContent />
    </DockProvider>
  );
}
