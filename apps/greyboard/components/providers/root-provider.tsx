"use client";

import { Toaster } from "sonner";
// all the providers go here
import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { ReactQueryProvider } from "./react-query-provider";

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  useThemeToggle();
  return children;
}

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <ThemeProvider
        attribute='class'
        defaultTheme='light'
        enableSystem
        disableTransitionOnChange
        storageKey='theme'
        themes={["light", "dark"]}
      >
        <ThemeWrapper>
          {children}
          <Toaster />
        </ThemeWrapper>
      </ThemeProvider>
    </ReactQueryProvider>
  );
}
