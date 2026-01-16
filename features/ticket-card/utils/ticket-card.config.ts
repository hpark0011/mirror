import type { Variants } from "framer-motion";

import type { ColumnId } from "@/types/board.types";
import { cn } from "@/lib/utils";

/**
 * Animation variants for ticket card entrance animations
 */
export const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.98,
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: index * 0.05,
      type: "spring",
      damping: 20,
      stiffness: 300,
    },
  }),
};

/**
 * Status-specific styling for ticket cards
 */
export const statusStyles: Record<ColumnId, string> = {
  backlog: "",
  "to-do": "",
  "in-progress":
    "shadow-[0_8px_8px_-4px_rgba(255,255,255,0.9),_0_12px_12px_-6px_rgba(0,0,0,0.3)] hover:shadow-[0_24px_24px_-12px_rgba(255,255,255,0.9),_0_24px_24px_-12px_rgba(19, 10, 10, 0.3)] dark:shadow-[0_8px_12px_-4px_rgba(0,0,0,0.12),_0_12px_12px_-6px_rgba(0,0,0,0.9)] dark:hover:shadow-[0_24px_24px_-12px_rgba(255,255,255,0.15),_0_24px_24px_-12px_rgba(19, 10, 10, 0.3)] hover:bg-base",
  complete:
    "bg-white/80 dark:bg-card border-white/30 dark:border-white/2 row-span-full row-start-1 hidden border-x bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-black)]/5 md:col-start-3 md:block dark:[--pattern-fg:var(--color-white)]/5",
};

/**
 * Style constants for the card wrapper element
 */
export const cardWrapperStyles = {
  base: cn(
    // Positioning
    "relative",
    // Transform & Animation
    "scale-100 hover:scale-[1.02]",
    "transition-all duration-200 ease-out"
  ),
  dragging: "rotate-5 scale-105",
} as const;

/**
 * Style constants for the main card element
 */
export const cardBaseStyles = cn(
  // Layout & Spacing
  "p-0 gap-0",
  // Positioning
  "relative",
  // Shape
  "rounded-[12px]",
  // Background
  "bg-card",
  // Border
  "border border-card-border hover:border-opacity-100",
  // Shadow
  "inset-shadow-none shadow-xs",
  "hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3)]",
  "dark:hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.15),_0_14px_14px_-6px_rgba(0,0,0,0.9)]",
  // Transform & Animation
  "translate-y-0 hover:translate-y-[-1px]",
  "transition-all duration-200 ease-out",
  // Interactive States
  "group cursor-grab active:cursor-grabbing",
  "hover:bg-base dark:hover:bg-neutral-900"
);

/**
 * Style constants for the sub-task content container
 */
export const subTaskContainerStyles = cn(
  // Layout & Spacing
  "p-0 overflow-hidden",
  // Spacing
  "mt-0.5",
  // Shape
  "rounded-b-[11px]",
  // Background
  "bg-dialog",
  // Border
  "border-border-light"
);

/**
 * Generates the complete card className based on status
 */
export function getCardClassName(status: ColumnId): string {
  return cn(cardBaseStyles, statusStyles[status]);
}

/**
 * Generates the wrapper className based on drag state
 */
export function getWrapperClassName(isDragging: boolean): string {
  return cn(cardWrapperStyles.base, isDragging && cardWrapperStyles.dragging);
}
