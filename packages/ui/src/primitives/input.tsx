import * as React from "react";

import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const inputVariants = cva(
  cn( // Layout & Sizing
    "h-9 w-full min-w-0 px-2.5 py-1",
    // Shape
    "rounded-lg",
    // Background & Colors
    "bg-transparent dark:bg-input/30  hover:bg-accent hover:border-accent dark:hover:bg-accent dark:hover:border-accent",
    // Text & Typography
    "text-base md:text-sm placeholder:text-muted-foreground",
    "selection:bg-primary selection:text-primary-foreground",
    // File Input Styles
    "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    // Interactive States
    "outline-none transition-[color,box-shadow]",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    // Focus States
    "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px]",
    // Invalid States
    "aria-invalid:border-input-destructive aria-invalid:ring-input-destructive aria-invalid:ring-[3px] dark:aria-invalid:ring-input-destructive dark:aria-invalid:border-input-destructive",
    // Caret
    "caret-caret",
  ),
  {
    variants: {
      variant: {
        default: cn(
          "border border-input",
          "rounded-lg",
          "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px]",
        ),
        underline: cn(
          "border-b border-input",
          "rounded-none",
          "px-1.5",
          "focus-visible:ring-0 focus-visible:bg-accent focus-visible:border-accent",
          "dark:bg-transparent dark:focus-visible:bg-accent",
          "transition-all duration-100 ease-out focus-visible:rounded-lg focus-visible:px-2.5",
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Input(
  { className, type, variant = "default", ...props }:
    & React.ComponentProps<"input">
    & VariantProps<typeof inputVariants>,
) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Input };
