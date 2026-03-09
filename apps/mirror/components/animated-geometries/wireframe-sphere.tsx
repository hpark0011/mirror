import "./wireframe-sphere.css";
import { cn } from "@feel-good/utils/cn";
import { GeometryScene } from "./geometry-scene";

const RING_COUNT = 12;
const RING_STEP = 180 / RING_COUNT; // 15°

function WireframeSphere({ className }: { className?: string }) {
  return (
    <GeometryScene
      slot="wireframe-sphere"
      className={cn("size-[144px]", className)}
      perspective="1000px"
      perspectiveOrigin="0% -45%"
      stageStyle={{ animation: "wireframe-sphere-rotate 20s linear infinite" }}
    >
      {/* Longitude rings */}
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full"
          style={{
            transform: `rotateY(${i * RING_STEP}deg)`,
            transformStyle: "preserve-3d",
            border:
              "1.5px solid color-mix(in srgb, currentColor 10%, transparent)",
            backgroundColor:
              "color-mix(in srgb, currentColor 5%, transparent)",
            boxShadow:
              "0 0 1px color-mix(in srgb, currentColor 0%, transparent), 0px 2px 3px -5px rgba(0,0,0,0.1)",
          }}
        />
      ))}

      {/* Equator ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border:
            "2.5px solid color-mix(in srgb, currentColor 10%, transparent)",
          transform: "rotateX(90deg)",
          transformStyle: "preserve-3d",
        }}
      />
    </GeometryScene>
  );
}

export { WireframeSphere };
