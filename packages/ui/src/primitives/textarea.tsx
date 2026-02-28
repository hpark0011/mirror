import * as React from "react";

import { cn } from "../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full",
        "rounded-md border border-input",
        "bg-transparent dark:bg-input/30",
        "px-3 py-2",
        "text-base md:text-sm caret-caret",
        "shadow-xs",
        "placeholder:text-muted-foreground",
        "transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "disabled:cursor-not-allowed disabled:opacity-50 leading-[1.3]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
