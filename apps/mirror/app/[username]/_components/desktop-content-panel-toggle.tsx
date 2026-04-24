import { VinylRecord } from "@/components/animated-geometries/vinyl-record";

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
    ? "Show artifacts"
    : "Hide artifacts";

  return (
    <div className="flex flex-col gap-2 items-center">
      <button
        type="button"
        aria-controls={contentPanelId}
        aria-expanded={!isContentPanelCollapsed}
        aria-label={buttonLabel}
        onClick={toggleContentPanel}
        className="w-11 h-11 flex items-center justify-center cursor-pointer outline-none rounded-[20px] [corner-shape:superellipse(1.3)]"
      >
        <VinylRecord spinning={!isContentPanelCollapsed} />
      </button>
      <span className="text-xs text-center text-muted-foreground">
        Artifacts
      </span>
    </div>
  );
}
