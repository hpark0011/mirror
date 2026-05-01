import { type ReactNode } from "react";

type ContentToolbarShellProps = {
  children: ReactNode;
};

export function ContentToolbarShell({ children }: ContentToolbarShellProps) {
  return (
    <div className="flex h-9 gap-3 px-3.5 md:justify-between justify-end items-center bg-background relative border-b border-border-subtle pb-1.5">
      {children}
    </div>
  );
}
