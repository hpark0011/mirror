"use client";

import { type ReactNode } from "react";
import { cn } from "@feel-good/ui/lib/utils";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";

export interface DockItemProps {
  children: ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function DockItem({
  children,
  label,
  isActive,
  onClick,
  className,
}: DockItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="button"
          aria-pressed={isActive}
          aria-label={label}
          data-slot="dock-item"
          onClick={onClick}
          className={cn(
            "relative cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
