import { cn } from "@/lib/utils";
import { getProjectColorBgClass } from "@/config/tasks.config";
import type { ProjectColor } from "@/types/board.types";

interface ProjectColorIndicatorProps {
  color: ProjectColor;
  name: string;
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ProjectColorIndicator({
  color,
  name,
  className,
  size = "sm",
  showLabel = true,
}: ProjectColorIndicatorProps) {
  const sizeClasses = {
    sm: "size-1.5",
    md: "size-2",
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "rounded-full flex-shrink-0",
          sizeClasses[size],
          getProjectColorBgClass(color)
        )}
      />
      {showLabel && <span className='truncate text-[13px]'>{name}</span>}
    </div>
  );
}
