"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { cn } from "@feel-good/utils/cn";
import { VinylRecord } from "@/components/animated-geometries/vinyl-record";
import { useOptionalWorkspaceChrome } from "@/app/[username]/_providers/workspace-chrome-context";

export function InteractionPanelToggle() {
  const workspaceChrome = useOptionalWorkspaceChrome();

  if (!workspaceChrome) return null;

  const {
    interactionPanelId,
    isInteractionPanelCollapsed,
    toggleInteractionPanel,
  } = workspaceChrome;

  const label = isInteractionPanelCollapsed ? "Show Author" : "Hide Author";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-controls={interactionPanelId}
          aria-expanded={!isInteractionPanelCollapsed}
          aria-label={label}
          data-slot="dock-item"
          data-state={isInteractionPanelCollapsed ? "closed" : "open"}
          onClick={toggleInteractionPanel}
          className={cn(
            "relative flex size-10 cursor-pointer items-center justify-center rounded-[12px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <VinylRecord />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
