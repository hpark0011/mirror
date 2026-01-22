import { cn } from "@/lib/utils";

interface TasksHeaderFocusDisplayProps {
  todayFocus: string | null;
  onClick: () => void;
}

export function TasksHeaderFocusDisplay({
  todayFocus,
  onClick,
}: TasksHeaderFocusDisplayProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Layout
        "flex items-center",
        // Shape
        "rounded-sm border",
        // Background
        "bg-card hover:bg-base",
        // Sizing
        "h-[24px]",
        // Positioning
        "translate-y-[0px] hover:translate-y-[-1px] scale-100",
        // Interactive states
        "cursor-pointer transition-all duration-200 ease-out",
        // Shadow
        "shadow-xs hover:shadow-lg",
        // Border
        "border-border-highlight dark:border-white/2",
        // Typography
        "text-[14px] whitespace-nowrap",
        // Overflow
        "overflow-hidden",
      )}
    >
      <div
        className={cn(
          // Layout
          "flex items-center",
          // Typography
          "text-text-muted font-medium",
          // Spacing
          "px-2",
          // Sizing
          "h-full shrink-0",
        )}
      >
        {new Date().toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div
        className={cn(
          // Sizing
          "w-px self-stretch shrink-0",
          // Spacing
          "mx-0",
          // Background
          "bg-border-medium/50 dark:bg-border-medium",
        )}
      />
      <span
        className={cn(
          // Layout
          "flex items-center",
          // Interactive states
          "hover:bg-neutral-100 dark:hover:bg-neutral-700 dark:hover:text-white/70",
          // Spacing
          "px-2",
          // Sizing
          "h-full min-w-0",
          // Typography
          "truncate",
          todayFocus
            ? "text-text-primary font-medium"
            : "text-text-muted font-[480]",
        )}
      >
        {todayFocus || "Set today's focus"}
      </span>
    </button>
  );
}
