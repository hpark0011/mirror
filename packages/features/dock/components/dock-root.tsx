"use client";

import { type ReactNode } from "react";

import { cn } from "@feel-good/ui/lib/utils";
import React from "react";

export interface DockRootProps {
  children: ReactNode;
  className?: string;
}

export function DockRoot({ children, className }: DockRootProps) {
  return (
    <div
      data-slot="dock-root"
      className={cn("fixed inset-x-0 bottom-0 z-50", className)}
    >
      {children}
    </div>
  );
}
