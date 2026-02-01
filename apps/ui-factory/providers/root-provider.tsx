"use client";

import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
