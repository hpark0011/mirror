import * as React from "react";

export type RingPercentageProps = {
  /** Percentage value between 0 and 100 */
  value: number;
  /** Diameter of the ring in pixels */
  size?: number;
  /** Width of the ring stroke in pixels */
  strokeWidth?: number;
  /** Track color (CSS color) */
  trackColor?: string;
  /** Progress color (CSS color) */
  progressColor?: string;
  /** Center text override (defaults to `${value}%`) */
  label?: string;
  /** Animate stroke changes */
  animate?: boolean;
  className?: string;
  /** Accessible label for the progress ring */
  ariaLabel?: string;
};

/**
 * A lightweight, accessible circular progress ring.
 * Uses an SVG circle with stroke-dashoffset to visualize the percentage.
 */
export function RingPercentage({
  value,
  size = 96,
  strokeWidth = 3.5,
  trackColor = "var(--color-dq-gray-150)", // Tailwind gray-200
  progressColor = "var(--color-green-500)", // Deep navy-like
  label,
  animate = true,
  className,
  ariaLabel = "progress",
}: RingPercentageProps) {
  const clamped = Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0)
  );
  const center = size / 2;
  const radius = Math.max(0, center - strokeWidth / 2);
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-block",
      }}
      role='img'
      aria-label={`${ariaLabel}: ${clamped}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <title>{`${clamped}%`}</title>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill='transparent'
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill='transparent'
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            transition: animate ? "stroke-dashoffset 800ms ease" : undefined,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
        }}
        aria-hidden
      >
        <span
          style={{
            fontWeight: 700,
            fontFeatureSettings: "'tnum' on",
            fontSize: "11px",
          }}
        >
          {label ?? `${clamped}`}
        </span>
      </div>
    </div>
  );
}

export default RingPercentage;
