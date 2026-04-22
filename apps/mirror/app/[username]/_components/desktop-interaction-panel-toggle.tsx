import { VinylRecord } from "@/components/animated-geometries/vinyl-record";
import { cn } from "@feel-good/utils/cn";

type DesktopInteractionPanelToggleProps = {
  interactionPanelId: string;
  isInteractionPanelCollapsed: boolean;
  toggleInteractionPanel: () => void;
};

export function DesktopInteractionPanelToggle({
  interactionPanelId,
  isInteractionPanelCollapsed,
  toggleInteractionPanel,
}: DesktopInteractionPanelToggleProps) {
  const buttonLabel = isInteractionPanelCollapsed
    ? "Show Author"
    : "Hide Author";

  return (
    <button
      type="button"
      aria-controls={interactionPanelId}
      aria-expanded={!isInteractionPanelCollapsed}
      aria-label={buttonLabel}
      data-state={isInteractionPanelCollapsed ? "closed" : "open"}
      className="absolute top-1/2 left-0 group h-14 w-[136px] -translate-y-full cursor-pointer z-40 pointer-events-auto outline-none"
      onClick={toggleInteractionPanel}
    >
      <div
        className={cn(
          "absolute top-2 flex items-center gap-2 transition-[left,opacity] duration-200 ease-in-out",
          isInteractionPanelCollapsed ? "left-3" : "-left-5 group-hover:left-3",
        )}
      >
        <VinylRecord />
        <div
          className={cn(
            "text-xs leading-[1.1] text-muted-foreground transition-opacity duration-200 ease-in-out",
            "opacity-0 group-hover:opacity-100",
          )}
        >
          {buttonLabel}
        </div>
      </div>
    </button>
  );
}
