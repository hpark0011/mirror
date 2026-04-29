"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { Icon } from "../components/icon";
import { cn } from "../lib/utils";

function Checkbox({
  className,
  checked,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Layout
        "peer shrink-0 flex items-center justify-center",
        // Sizing
        "size-4.5",
        // Shape & border
        "rounded-full border border-input",
        // Background
        "dark:bg-input/30 data-[state=checked]:bg-primary dark:data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
        "data-[state=indeterminate]:bg-primary dark:data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary",
        // Shadow & transition
        "transition-shadow outline-none",
        // Focus
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      checked={checked}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none relative"
      >
        {checked === "indeterminate"
          ? (
            <Icon
              name="MinusSmallIcon"
              className="size-4 relative"
            />
          )
          : (
            <Icon
              name="CheckmarkSmallIcon"
              className="size-4 relative"
            />
          )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
