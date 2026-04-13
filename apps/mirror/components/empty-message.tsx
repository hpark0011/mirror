import { HeptagonalPrism } from "@/components/animated-geometries/heptagonal-prism";

export function EmptyMessage({
  message,
  showGraphic = false,
  graphicTopLabel,
  graphicBottomLabel,
}: {
  message?: string;
  showGraphic?: boolean;
  graphicTopLabel?: string;
  graphicBottomLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 pb-16 text-muted-foreground">
      {showGraphic && (
        <HeptagonalPrism
          topLabel={graphicTopLabel}
          bottomLabel={graphicBottomLabel}
        />
      )}
      <p>{message}</p>
    </div>
  );
}
