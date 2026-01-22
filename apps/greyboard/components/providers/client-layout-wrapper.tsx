"use client";

import { RootProvider } from "./root-provider";

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <RootProvider>{children}</RootProvider>;
}