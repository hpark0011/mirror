"use client";

import { motion, useReducedMotion } from "framer-motion";

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
  /** Toggle numeric label display */
  showLabel?: boolean;
};

const SPRING_TRANSITION = {
  type: "spring" as const,
  stiffness: 170,
  damping: 26,
  mass: 0.7,
};

/**
 * A lightweight, accessible circular progress ring.
 * Uses an SVG circle with stroke-dashoffset to visualize the percentage.
 */
export function RingPercentage({
  value,
  size = 12,
  strokeWidth = 1,
  trackColor = "var(--color-neutral-200)", // Tailwind gray-200
  progressColor = "var(--color-neutral-400)", // Deep navy-like
  label,
  animate = true,
  className,
  ariaLabel = "progress",
  showLabel = true,
}: RingPercentageProps) {
  const clamped = Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0)
  );
  const center = size / 2;
  const radius = Math.max(0, center - strokeWidth / 2);
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const shouldReduceMotion = useReducedMotion();
  const animationEnabled = animate && !shouldReduceMotion;

  return (
    <div
      className={className}
      style={{
        width: "fit-content",
        height: size,
        position: "relative",
        display: "flex",
        alignItems: "center",
      }}
      role='img'
      aria-label={`${ariaLabel}: ${clamped}%`}
    >
      {showLabel && (
        <div
          style={{
            position: "relative",
            inset: 0,
            display: "grid",
            placeItems: "center",
            marginRight: "3px",
          }}
          aria-hidden
        >
          <span
            style={{
              fontWeight: 600,
              fontFeatureSettings: "'tnum' on",
              fontSize: "12px",
              color: "var(--color-neutral-500)",
            }}
          >
            {label ?? `${clamped}%`}
          </span>
        </div>
      )}
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
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill='transparent'
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
          strokeDasharray={`${circumference} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
          initial={false}
          {...(animationEnabled
            ? {
                animate: { strokeDashoffset: offset },
                transition: SPRING_TRANSITION,
              }
            : {
                style: { strokeDashoffset: offset },
              })}
        />
      </svg>
    </div>
  );
}

export default RingPercentage;
