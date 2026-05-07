import { type ReactNode } from "react";

interface AuthSectionHeaderProps {
  children: ReactNode;
}

export function AuthSectionHeader({ children }: AuthSectionHeaderProps) {
  return (
    <h2 className="text-muted-foreground text-center text-lg font-medium">
      {children}
    </h2>
  );
}
