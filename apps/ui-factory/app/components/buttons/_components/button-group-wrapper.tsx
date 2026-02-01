import { cn } from "@feel-good/ui/lib/utils";

interface ButtonGroupWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ButtonGroupWrapper(
  { children, className }: ButtonGroupWrapperProps,
) {
  return (
    <div className={cn("flex gap-3 w-full flex-wrap", className)}>
      {children}
    </div>
  );
}
