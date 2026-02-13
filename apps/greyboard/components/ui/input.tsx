import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        data-slot="input"
        className={cn(
          // Layout
          "flex w-full min-w-0",
          // Shape
          "rounded-md border border-input",
          // Background
          "bg-transparent hover:bg-hover",
          // Sizing
          "h-9 px-2.5 py-1",
          // Typography
          "text-text-primary text-[13px] md:text-[13px]",
          // Interactive states
          "outline-none transition-[color,box-shadow]",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive dark:aria-invalid:ring-destructive/40",
          // File input styles
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground",
          // Placeholder
          "placeholder:text-muted-foreground",
          // Selection
          "selection:bg-primary selection:text-primary-foreground",
          // Caret
          "caret-caret",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
