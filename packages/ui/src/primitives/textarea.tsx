import * as React from "react";

import { cn } from "../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none",
        "rounded-[7px] border border-input [corner-shape:superellipse(1.2)]",
        "bg-transparent dark:bg-input/30",
        "px-2 py-1.5",
        "text-base md:text-[13px] caret-caret",
        "placeholder:text-muted-foreground",
        "transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[2px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "disabled:cursor-not-allowed disabled:opacity-50 leading-[1.3]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
