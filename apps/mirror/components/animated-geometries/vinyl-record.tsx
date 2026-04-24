import "./vinyl-record.css";
import { cn } from "@feel-good/utils/cn";
import { GeometryScene } from "./geometry-scene";

const EMPTY_STAGE_STYLE = {} as const;

/** Spinning vinyl record geometry. */
function VinylRecord({
  className,
  spinning = true,
}: {
  className?: string;
  spinning?: boolean;
}) {
  return (
    <GeometryScene
      slot="vinyl-record"
      className={cn("size-[36px]", className)}
      perspective="none"
      stageStyle={EMPTY_STAGE_STYLE}
    >
      <div className={cn("vinyl-record", !spinning && "vinyl-record-paused")}>
        <div className="vinyl-record-shine" />
        <div className="vinyl-record-label">
          <div className="vinyl-record-spindle" />
        </div>
      </div>
    </GeometryScene>
  );
}

export { VinylRecord };
