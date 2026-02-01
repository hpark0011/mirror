import { cn } from "@feel-good/ui/lib/utils";

interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return <div className={cn("h-px bg-border", className)} />;
}
