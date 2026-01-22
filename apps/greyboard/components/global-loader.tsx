import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlobalLoaderProps {
  className?: string;
  spinnerClassName?: string;
}

export function GlobalLoader({
  className,
  spinnerClassName,
}: GlobalLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-4",
        className
      )}
    >
      <LoaderCircle
        className={cn("h-4 w-4 animate-spin text-text-muted", spinnerClassName)}
      />
    </div>
  );
}
