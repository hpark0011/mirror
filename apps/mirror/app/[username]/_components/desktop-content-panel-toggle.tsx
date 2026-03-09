import { VinylRecord } from "@/components/animated-geometries/vinyl-record";
import { cn } from "@feel-good/utils/cn";

type DesktopContentPanelToggleProps = {
  contentPanelId: string;
  isContentPanelCollapsed: boolean;
  toggleContentPanel: () => void;
};

export function DesktopContentPanelToggle({
  contentPanelId,
  isContentPanelCollapsed,
  toggleContentPanel,
}: DesktopContentPanelToggleProps) {
  const buttonLabel = isContentPanelCollapsed
    ? "Show Artifacts"
    : "Hide Artifacts";

  return (
    <button
      type="button"
      aria-controls={contentPanelId}
      aria-expanded={!isContentPanelCollapsed}
      aria-label={buttonLabel}
      data-state={isContentPanelCollapsed ? "closed" : "open"}
      className="absolute top-1/2 right-0 group h-14 w-[136px] -translate-y-full cursor-pointer z-40 pointer-events-auto outline-none"
      onClick={toggleContentPanel}
    >
      <div
        className={cn(
          "absolute top-2 flex items-center gap-2 transition-[right,opacity] duration-200 ease-in-out",
          isContentPanelCollapsed ? "right-3" : "-right-5 group-hover:right-3",
        )}
      >
        <div
          className={cn(
            "text-xs leading-[1.1] text-muted-foreground transition-opacity duration-200 ease-in-out",
            "opacity-0 group-hover:opacity-100",
          )}
        >
          {buttonLabel}
        </div>
        <VinylRecord />
      </div>
    </button>
  );
}
