import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  cn(
    // Layout
    "inline-flex shrink-0",
    // Alignment & Spacing
    "items-center justify-center gap-2",
    // Typography
    "whitespace-nowrap text-sm font-medium",
    // Transitions
    "transition-all",
    // Disabled states
    "disabled:pointer-events-none disabled:opacity-50",
    // SVG handling
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    // Focus states
    "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    // Invalid states
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    // Active states
    "active:scale-97 cursor-pointer transition-all duration-100 ease-out",
  ),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/95 shadow-button-primary hover:shadow-button-primary-hover",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background hover:bg-border hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "bg-ghost hover:bg-accent/80 text-ghost-foreground hover:text-accent-foreground dark:hover:bg-accent/50 [&_svg]:text-icon",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Default button size
        default:
          "h-8 px-3 py-2 has-[>svg]:px-3 rounded-[9px] [corner-shape:superellipse(1.2)]",
        xs:
          "h-6 gap-1 rounded-[7px] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3 [corner-shape:superellipse(1.2)]",
        sm:
          "h-7 rounded-[8px] gap-1.5 px-2.5 has-[>svg]:px-2.5 has-[>svg]:pl-2 has-[>svg]:gap-1 text-[13px] [corner-shape:superellipse(1.2)]",
        lg:
          "h-10 rounded-[11px] px-6 has-[>svg]:px-4 [corner-shape:superellipse(1.2)]",
        // Icon button sizes
        icon: "size-8 rounded-[9px]",
        "icon-xs": "size-6 rounded-[7px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-lg",
        "icon-lg": "size-9 rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}:
  & React.ComponentProps<"button">
  & VariantProps<typeof buttonVariants>
  & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
