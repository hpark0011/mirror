"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "../lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // Layout
        "inline-flex shrink-0 items-center",
        // Shape
        "rounded-full",
        // Background
        "data-[state=checked]:bg-input data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
        // Border
        "border border-transparent",
        // Sizing
        "data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6",
        // Interactive states
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        // Transition & outline
        "transition-all outline-none",
        // Group & peer
        "group/switch peer",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // Layout
          "block",
          // Shape
          "rounded-full",
          // Background
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground",
          // Shadow
          "shadow-xs",
          // Sizing
          "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
          // Positioning
          "data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
          // Interactive states
          "pointer-events-none",
          // Transition & ring
          "transition-transform ring-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
