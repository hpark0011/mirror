"use client";

import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";
import { SidebarProvider } from "@feel-good/ui/primitives/sidebar";
import { TooltipProvider } from "@feel-good/ui/primitives/tooltip";

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      {/* Explicit root TooltipProvider — the shared Tooltip primitive no
          longer self-wraps one. Do NOT rely on SidebarProvider's internal
          provider; routes outside a sidebar would lose tooltip context. */}
      <TooltipProvider>
        <SidebarProvider>{children}</SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
