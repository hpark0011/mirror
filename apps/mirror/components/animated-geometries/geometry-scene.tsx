import { cn } from "@feel-good/utils/cn";

interface GeometrySceneProps {
  slot: string;
  className?: string;
  perspective: string;
  perspectiveOrigin?: string;
  stageStyle: React.CSSProperties;
  children: React.ReactNode;
}

function GeometryScene({
  slot,
  className,
  perspective,
  perspectiveOrigin,
  stageStyle,
  children,
}: GeometrySceneProps) {
  return (
    <div
      data-slot={slot}
      className={cn("text-primary", className)}
      style={{ perspective, perspectiveOrigin }}
    >
      <div
        className="relative size-full"
        style={{ transformStyle: "preserve-3d", ...stageStyle }}
      >
        {children}
      </div>
    </div>
  );
}

export { GeometryScene };
