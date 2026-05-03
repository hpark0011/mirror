"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { getConvexClient } from "@/lib/convex";
import { ConvexAuthProbe } from "./convex-auth-probe";

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={getConvexClient()} authClient={authClient}>
      <ConvexAuthProbe />
      {children}
    </ConvexBetterAuthProvider>
  );
}
