"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { cn } from "@feel-good/utils/cn";
import type { ReactNode } from "react";

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
  children: ReactNode;
  tabIndex?: number;
  className?: string;
}

/**
 * The base toolbar button used by both the bubble menu and the fixed
 * toolbar. Carries `data-active` so tests can assert active state without
 * relying on a CSS class.
 */
export function ToolbarButton({
  label,
  onClick,
  disabled,
  isActive,
  children,
  tabIndex,
  className,
}: ToolbarButtonProps) {
  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "tiptap-toolbar-btn",
            "[corner-shape:superellipse(1.3)]",
            className,
          )}
          aria-label={label}
          aria-pressed={isActive}
          aria-disabled={disabled || undefined}
          data-active={isActive ? "true" : "false"}
          onClick={(e) => {
            e.preventDefault();
            if (!disabled) onClick();
          }}
          onMouseDown={(e) => e.preventDefault()}
          disabled={disabled}
          tabIndex={tabIndex}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={4}
        className="px-1.5 py-1 rounded-sm"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
