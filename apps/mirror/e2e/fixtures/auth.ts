import { test as base, type Page } from "@playwright/test";

type AuthFixtures = {
  authenticatedPage: Page;
  authenticatedPageNoUsername: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  authenticatedPageNoUsername: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/user-no-username.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

/**
 * Wait for the in-page Convex client to finish installing the Better Auth
 * JWT — i.e., for `useConvexAuth()` to report `isAuthenticated === true`.
 *
 * Root cause of the original "Convex client-auth race":
 *   `ConvexBetterAuthProvider` ships an `useEffect` that runs *after* mount
 *   and:
 *     1. reads the Better Auth session via `authClient.useSession()`,
 *     2. asynchronously calls `authClient.convex.token()` to fetch the JWT,
 *     3. only then calls `client.setAuth(...)` so the websocket round-trips
 *        through the auth code.
 *   Any `useMutation(...)` fired during those microtasks (e.g., the
 *   inline-image-upload-url generator triggered by the FIRST paste) hits
 *   `Unauthenticated`. Pre-warming the convex_jwt cookie in
 *   `app/api/test/session` doesn't help because the cookie is *already* set;
 *   the gap is the client effect, not the network.
 *
 *   The deterministic signal we wait on is the `<ConvexAuthProbe>` mounted
 *   inside `apps/mirror/providers/convex-provider.tsx` — it mirrors
 *   `useConvexAuth()` into a hidden DOM element, and "isAuthenticated=true"
 *   only flips after `client.setAuth`'s onChange callback fires.
 *
 * Call this AFTER `page.goto(...)` and BEFORE any interaction that triggers
 * a client-side `useMutation(...)` (paste, drop, save, dialog submit).
 */
export async function waitForAuthReady(
  page: Page,
  options: { timeout?: number } = {},
): Promise<void> {
  const { timeout = 15_000 } = options;
  await page
    .locator('[data-testid="convex-auth-state"][data-authenticated="true"]')
    .waitFor({ state: "attached", timeout });
}

export { expect } from "@playwright/test";
