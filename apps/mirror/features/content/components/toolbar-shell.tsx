import { type ReactNode } from "react";
import { cn } from "@feel-good/utils/cn";

type ContentToolbarShellProps = {
  children: ReactNode;
  variant?: "list" | "detail";
};

export function ContentToolbarShell({
  children,
  variant = "list",
}: ContentToolbarShellProps) {
  return (
    <div
      className={cn(
        "flex h-9 gap-3 px-3.5 items-center bg-background relative border-b border-border-subtle pb-1.5",
        variant === "list"
          ? "md:justify-between justify-end"
          : "justify-between",
      )}
    >
      {children}
    </div>
  );
}
