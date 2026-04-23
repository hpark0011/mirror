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
  if (!isContentPanelCollapsed) {
    return null;
  }

  const buttonLabel = "Hide Artifacts";

  return (
    <button
      type="button"
      aria-controls={contentPanelId}
      aria-expanded
      aria-label={buttonLabel}
      data-state="open"
      className="absolute top-3 right-3 group cursor-pointer z-40 pointer-events-auto outline-none"
      onClick={toggleContentPanel}
    >
      <div
        className={cn(
          "flex items-center gap-2 transition-[right,opacity] duration-200 ease-in-out",
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
