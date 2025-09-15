"use client";

// all the providers go here
import { ThemeProvider } from "@/components/providers/theme-provider";
import { useThemeToggle } from "@/hooks/use-theme-toggle";

import { Toaster } from "sonner";
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
