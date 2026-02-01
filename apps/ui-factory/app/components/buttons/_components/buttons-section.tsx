import { cn } from "@feel-good/ui/lib/utils";

interface ButtonsSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function ButtonsSection({ children, className }: ButtonsSectionProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-7 py-1.5 pb-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
