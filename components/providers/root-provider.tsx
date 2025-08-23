"use client";

// all the providers go here
import { ThemeProvider } from "@/components/providers/theme-provider";

import { Toaster } from "sonner";
import { ReactQueryProvider } from "./react-query-provider";
// import { useThemeToggle } from "@/hooks/use-theme-toggle";
// import { NavigationProvider } from "../navigation/navigation-context";

// ThemeWrapper is used to toggle the theme when the user presses the command + k key. This is only for development purposes.
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  // useThemeToggle();
  // Initialize auth persistence for Electron
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
        // themes={['light', 'dark']}
      >
        {/* <ThemeWrapper> */}
        {children}
        <Toaster />
        {/* </ThemeWrapper> */}
      </ThemeProvider>
    </ReactQueryProvider>
  );
}
