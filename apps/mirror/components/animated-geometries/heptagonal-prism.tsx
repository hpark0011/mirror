import "./heptagonal-prism.css";
import { cn } from "@feel-good/utils/cn";
import { GeometryScene } from "./geometry-scene";

const SIDE_COUNT = 7;
const ANGLE_STEP = (2 * Math.PI) / SIDE_COUNT;
const ARC_WIDTH = 84;
const ARC_HEIGHT = 84;
const RADIUS = ARC_WIDTH / (2 * Math.tan(Math.PI / SIDE_COUNT));

function HeptagonalPrism({ className }: { className?: string }) {
  return (
    <GeometryScene
      slot="heptagonal-prism"
      className={cn("size-[160px]", className)}
      perspective="2000px"
      stageStyle={{
        animation: "heptagonal-prism-spin 11s linear infinite",
      }}
      perspectiveOrigin="100% -480%"
    >
      {Array.from({ length: SIDE_COUNT }, (_, i) => {
        const angle = ANGLE_STEP * i;
        return (
          <div
            key={i}
            className="pointer-events-none absolute left-1/2 top-1/2 flex flex-col items-center justify-center border-x border-t border-white dark:border-gray-5 bg-gray-3 dark:bg-gray-3 shadow-[0px_3px_4px_-3px_rgba(0,0,0,0.07)] dark:shadow-[0px_2px_4px_-2px_rgba(0,0,0,0.4)]"
            style={{
              width: `${ARC_WIDTH}px`,
              height: `${ARC_HEIGHT}px`,
              marginLeft: `${-ARC_WIDTH / 2}px`,
              marginTop: `${-ARC_HEIGHT / 2}px`,
              transform: `rotateY(${
                (angle * 180) / Math.PI
              }deg) translateZ(${RADIUS}px) rotateX(20deg)`,
              transformStyle: "preserve-3d",
              borderTopLeftRadius: "80px",
              borderTopRightRadius: "80px",
            }}
          >
            <div className="flex flex-col items-center justify-between pb-3.5 pt-4 h-full font-medium text-gray-12 dark:text-gray-11">
              <span className="leading-1 text-sm">No</span>
              <span className="leading-1 text-sm">
                Posts
              </span>
            </div>
          </div>
        );
      })}
    </GeometryScene>
  );
}

export { HeptagonalPrism };
