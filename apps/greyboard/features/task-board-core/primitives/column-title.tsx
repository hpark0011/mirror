import { CardTitle } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";

interface ColumnTitleProps {
  icon: IconName;
  iconSize: string;
  iconColor: string;
  title: string;
  count: number;
}

/**
 * Displays column header with icon, title, and count badge.
 * View-agnostic primitive used by both board and list views.
 */
export function ColumnTitle({
  icon,
  iconSize,
  iconColor,
  title,
  count,
}: ColumnTitleProps) {
  return (
    <div className="flex items-center gap-1">
      <Icon name={icon} className={`${iconSize} ${iconColor}`} />
      <div className="flex items-baseline">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-[13px] text-primary px-1.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center">
          {count}
        </span>
      </div>
    </div>
  );
}
