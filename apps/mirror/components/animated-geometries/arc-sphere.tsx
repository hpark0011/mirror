import "./arc-sphere.css";
import { cn } from "@feel-good/utils/cn";
import { GeometryScene } from "./geometry-scene";

const LAYER_COUNT = 9;
const MIDDLE = Math.floor(LAYER_COUNT / 2); // 5

/** Z-offset, scale, and animation delay for each layer (back → front). */
function layerStyle(index: number): React.CSSProperties {
  const distFromMiddle = Math.abs(index - MIDDLE);
  const z = (index - MIDDLE) * -18; // +120 … 0 … –120
  // Scale: 1.0 at centre, shrinking toward edges
  const scale = [0.45, 0.65, 0.82, 0.92, 0.98, 1.0][MIDDLE - distFromMiddle];
  // Stagger delay so the wave ripples front-to-back
  const delay = index * 0.1;

  return {
    transform: `translateZ(${z}px) scale(${scale})`,
    animationDelay: `${delay}s`,
  };
}

/** 3D animated arc-sphere geometry designed for loading states. */
function ArcSphere({ className }: { className?: string }) {
  return (
    <GeometryScene
      slot="arc-sphere"
      className={cn("size-[140px] pb-4", className)}
      perspective="2000px"
      perspectiveOrigin="0% 0%"
      stageStyle={{ transform: "rotateX(-15deg) rotateY(-48deg)" }}
    >
      {Array.from({ length: LAYER_COUNT }, (_, i) => (
        <div
          key={i}
          className="pointer-events-none absolute inset-0 box-border"
          style={{
            border:
              "1.5px solid color-mix(in srgb, currentColor 15%, transparent)",
            backgroundColor:
              "color-mix(in srgb, currentColor 1%, transparent)",
            borderTopLeftRadius: "50% 50%",
            borderTopRightRadius: "50% 50%",
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            boxShadow:
              "0 0 1px color-mix(in srgb, currentColor 20%, transparent), 0px 8px 12px -10px rgba(0,0,0,0.25)",
            top: 0,
            position: "absolute",
            transformOrigin: "center bottom",
            transformStyle: "preserve-3d",
            animation: "arc-sphere-wave 1.5s ease-in-out infinite",
            zIndex: `${i}`,
            ...layerStyle(i),
          }}
        />
      ))}
    </GeometryScene>
  );
}

export { ArcSphere };
