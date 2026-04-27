"use client";

import { VinylRecord } from "@/components/animated-geometries/vinyl-record";
import { ShinyButton } from "@feel-good/ui/components/shiny-button";
import { useOptionalWorkspaceChrome } from "../_providers/workspace-chrome-context";
import { CONTENT_PANEL_ID } from "./workspace-panels";

export function ContentPanelToggle() {
  const chrome = useOptionalWorkspaceChrome();
  if (!chrome) return null;

  const { isContentPanelCollapsed, toggleContentPanel } = chrome;
  const buttonLabel = isContentPanelCollapsed
    ? "Show artifacts"
    : "Hide artifacts";

  const shinyButtonClass =
    `w-11 h-11 rounded-[20px] [corner-shape:superellipse(1.3)] [&>span]:drop-shadow-none border border-primary/5 ${
      isContentPanelCollapsed ? "bg-primary/20" : "bg-primary/20 shadow-xs"
    }`;
  const shinyButtonShadowClass =
    "rounded-[20px] [corner-shape:superellipse(1.3)]";

  return (
    <div className="flex flex-col gap-2 items-center">
      <ShinyButton
        type="button"
        aria-controls={CONTENT_PANEL_ID}
        aria-expanded={!isContentPanelCollapsed}
        aria-label={buttonLabel}
        onClick={toggleContentPanel}
        className={shinyButtonClass}
        shadowClassName={shinyButtonShadowClass}
      >
        <VinylRecord spinning={!isContentPanelCollapsed} />
      </ShinyButton>
      <span className="text-xs text-center text-muted-foreground">
        Artifacts
      </span>
    </div>
  );
}
