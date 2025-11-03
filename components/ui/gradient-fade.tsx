import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Creates a gradient fade overlay effect for content areas.
 *
 * Useful for indicating scrollable content or creating visual hierarchy.
 *
 * @param position - Direction of fade: 'top' or 'bottom'
 * @param height - Height in pixels or CSS string (default: 16)
 *
 * @example
 * <div className="relative">
 *   <textarea />
 *   <GradientFade position="bottom" height={32} />
 * </div>
 */

type GradientFadeProps = {
  position?: "top" | "bottom";
  height?: number | string;
} & HTMLAttributes<HTMLDivElement>;

export function GradientFade({
  position = "bottom",
  height = 16,
  className,
  style,
  ...props
}: GradientFadeProps) {
  const offsetClass = position === "top" ? "top-[-1px]" : "bottom-[-1px]";
  const directionClass =
    position === "top" ? "bg-gradient-to-b" : "bg-gradient-to-t";
  const heightValue = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      {...props}
      className={cn(
        "pointer-events-none absolute inset-x-0 from-dialog dark:from-dialog to-transparent",
        offsetClass,
        directionClass,
        className
      )}
      style={{
        height: heightValue,
        ...style,
      }}
    />
  );
}

export default GradientFade;
