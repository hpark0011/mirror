"use client";

import { motion } from "framer-motion";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

import { cardVariants, getWrapperClassName } from "../utils/ticket-card.config";

interface AnimatedTicketCardWrapperProps {
  children: ReactNode;
  isInitialLoad: boolean;
  isDragging: boolean;
  index: number;
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  onClick: (e: MouseEvent) => void;
  dragHandleProps: Record<string, unknown>;
}

/**
 * Wrapper that conditionally applies entrance animations to ticket cards.
 * Uses Framer Motion for staggered entrance on page load,
 * plain div during normal interactions to avoid overhead.
 */
export function AnimatedTicketCardWrapper({
  children,
  isInitialLoad,
  isDragging,
  index,
  setNodeRef,
  style,
  onClick,
  dragHandleProps,
}: AnimatedTicketCardWrapperProps) {
  const className = getWrapperClassName(isDragging);
  const shouldAnimate = isInitialLoad && !isDragging;

  if (shouldAnimate) {
    return (
      <motion.div
        ref={setNodeRef}
        style={style}
        className={className}
        onClick={onClick}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        custom={index}
        {...dragHandleProps}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      onClick={onClick}
      {...dragHandleProps}
    >
      {children}
    </div>
  );
}
