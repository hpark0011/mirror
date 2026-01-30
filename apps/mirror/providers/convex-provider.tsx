"use client";

import { ConvexProvider as BaseConvexProvider } from "@feel-good/convex";
import { getConvexClient } from "@/lib/convex";

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseConvexProvider client={getConvexClient()}>
      {children}
    </BaseConvexProvider>
  );
}
