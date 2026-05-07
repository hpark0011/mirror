"use client";

import { type ComponentType } from "react";

import { cn } from "@feel-good/ui/lib/utils";
import React from "react";

export interface DockIconProps {
  icon: ComponentType<{ className?: string }>;
  isActive?: boolean;
  className?: string;
}

export function DockIcon({ icon: Icon, isActive, className }: DockIconProps) {
  return (
    <div
      data-slot="dock-icon"
      data-active={isActive}
      className={cn(
        "size-10 p-2",
        "[corner-shape:superellipse(1.1)] rounded-[12px]",
        "bg-transparent",
        "flex items-center justify-center",
        "transition-all duration-100",
        "hover:bg-accent",
        "active:scale-97",
        isActive && "bg-accent shadow-dock-icon-active",
        className,
      )}
    >
      <Icon
        className={cn("text-icon", isActive && "text-primary")}
      />
    </div>
  );
}
