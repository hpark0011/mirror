"use client";

import { useConvexAuth } from "convex/react";

/**
 * Inert DOM probe that mirrors the current ConvexAuthState into the page so
 * Playwright (or any external observer) can wait for client-auth readiness.
 *
 * Why this exists: ConvexBetterAuthProvider installs the JWT asynchronously
 * after mount — `authClient.useSession()` resolves, then `fetchAccessToken()`
 * round-trips with `/api/auth/convex/token`, then `client.setAuth` reports
 * `isAuthenticated=true`. Mutations fired before that final hop hit
 * `Unauthenticated` even though the session cookie is already on the
 * browser. Playwright's authenticated specs need a deterministic signal
 * before interacting with anything that triggers a Convex mutation.
 *
 * Output: a single `<span>` (display:none) with two attributes the test
 * fixture polls — kept inert so the only cost in production is the React
 * render of one tiny element. See `apps/mirror/e2e/fixtures/auth.ts`'s
 * `waitForAuthReady(page)` helper for the consumer side.
 */
export function ConvexAuthProbe() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const state = isLoading
    ? "loading"
    : isAuthenticated
      ? "true"
      : "false";

  return (
    <span
      data-testid="convex-auth-state"
      data-authenticated={state}
      aria-hidden="true"
      style={{ display: "none" }}
    />
  );
}
