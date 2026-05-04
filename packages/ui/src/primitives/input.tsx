import * as React from "react";

import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const inputVariants = cva(
  cn( // Layout & Sizing
    "w-full min-w-0 py-1",
    // Background & Colors
    "bg-transparent dark:bg-input/30  hover:bg-accent hover:border-border/70 dark:hover:bg-accent dark:hover:border-accent",
    // Text & Typography
    "text-base md:text-sm placeholder:text-muted-foreground data-[size=sm]:text-[13px]",
    "selection:bg-primary selection:text-primary-foreground",
    // File Input Styles
    "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    // Interactive States
    "outline-none transition-[color,box-shadow]",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    // Invalid States
    "aria-invalid:border-input-destructive aria-invalid:ring-input-destructive aria-invalid:ring-[2px] dark:aria-invalid:ring-input-destructive dark:aria-invalid:border-input-destructive",
    // Caret
    "caret-caret",
  ),
  {
    variants: {
      variant: {
        default: cn(
          "border border-input-border",
          "rounded-lg px-2.5 data-[size=sm]:rounded-[7px] data-[size=sm]:px-2 [corner-shape:superellipse(1.2)]",
          "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[2px]",
        ),
        underline: cn(
          "border-b border-input",
          "rounded-none px-1.5",
          "focus-visible:ring-0 focus-visible:bg-accent focus-visible:border-accent",
          "dark:bg-transparent dark:focus-visible:bg-accent",
          "transition-all duration-100 ease-out focus-visible:rounded-lg focus-visible:px-2.5",
        ),
      },
      size: {
        default: "h-9",
        sm: "h-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Input(
  { className, type, variant = "default", size = "default", ...props }:
    & Omit<React.ComponentProps<"input">, "size">
    & VariantProps<typeof inputVariants>,
) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Input };
