/**
 * Root provider should be placed in the root layout.
 */

"use client";

import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";
import { SessionProvider } from "@/lib/auth-client";
import { ConvexProvider } from "./convex-provider";
import { I18nProvider } from "./i18n-provider";

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <I18nProvider>
        <ConvexProvider>
          <SessionProvider>{children}</SessionProvider>
        </ConvexProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
