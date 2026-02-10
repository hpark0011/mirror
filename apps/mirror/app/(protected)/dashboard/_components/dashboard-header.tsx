import { ThemeToggleButton } from "@feel-good/features/theme/components";
import { cn } from "@feel-good/utils/cn";

type DashboardHeaderProps = {
  className?: string;
};

export function DashboardHeader({ className }: DashboardHeaderProps) {
  return (
    <header className={cn("z-10 flex h-10 items-center gap-2 px-4 bg-linear-to-b from-background via-background/70 to-transparent justify-end", className)}>
      <ThemeToggleButton />
    </header>
  );
}
