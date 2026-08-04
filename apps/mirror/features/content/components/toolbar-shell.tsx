import { type ReactElement, type ReactNode } from "react";
import { cn } from "@feel-good/utils/cn";

type ContentToolbarShellProps = {
  children: ReactNode;
  variant?: "list" | "detail";
};

export function ContentToolbarShell({
  children,
  variant = "list",
}: ContentToolbarShellProps): ReactElement {
  const alignmentClassName =
    variant === "list" ? "justify-end md:justify-between" : "justify-between";

  return (
    <div
      className={cn(
        "relative flex h-full min-w-0 flex-1 items-center gap-3",
        alignmentClassName,
      )}
    >
      {children}
    </div>
  );
}
