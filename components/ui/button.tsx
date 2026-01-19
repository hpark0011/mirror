import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none  aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer has-[>svg]:gap-0.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        primary:
          "bg-medium-inverse dark:bg-dark-inverse text-light font-base shadow-button-primary transform transition-all disabled:text-secondary-inverse dark:disabled:text-dq-gray-700 dark:disabled:bg-medium disabled:shadow-none disabled:bg-dark hover:shadow-button-primary-hover hover:bg-extra-dark-inverse [&_svg:not([class*='size-'])]:text-icon-light ",
        ghost: "hover:bg-hover text-text-secondary",
        link: "text-primary underline-offset-4 hover:underline",
        icon: "has-[>svg]:px-1.5 hover:bg-hover",
      },
      size: {
        default: "h-8 px-4 py-2 has-[>svg]:px-3 rounded-[10px]",
        sm: "h-7 rounded-[8px] gap-1.5 px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-4.5 has-[svg]:pl-1.5 has-[svg]:pr-2.5",
        lg: "h-9 rounded-lg px-6 has-[>svg]:px-4",
        "icon-sm": "size-7 rounded-md p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "sm",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
