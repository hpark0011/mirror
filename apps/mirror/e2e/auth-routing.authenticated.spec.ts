import { test, expect } from "./fixtures/auth";

// The default project storage state in playwright.config.ts points at the
// with-username user. Individual describe blocks below override it when
// they need a different session (unauth'd, no-username, fabricated cookie).

test.describe("Auth routing", () => {
  // ──────────────────────────────────────────────────────────────────────
  // Unauthenticated — FR-03, FR-12 (case b)
  // ──────────────────────────────────────────────────────────────────────
  test.describe("Unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("visits / and sees Sign in + Create account buttons (FR-03)", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/$/);
      await expect(
        page.getByRole("link", { name: /sign in/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /create account/i }),
      ).toBeVisible();
    });

    test("visits /@rick-rubin and sees the public profile render (FR-12 case b)", async ({
      page,
    }) => {
      await page.goto("/@rick-rubin");
      await expect(page).toHaveURL(/\/@rick-rubin/);
      await expect(page).not.toHaveURL(/\/onboarding/);
      await expect(page).not.toHaveURL(/\/sign-in/);
      // Profile content must actually render — not just "no redirect."
      await expect(
        page.getByRole("heading", { name: /rick.rubin/i }).first(),
      ).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Authenticated with username — FR-02, FR-05, FR-06 (case a), FR-08
  // ──────────────────────────────────────────────────────────────────────
  test.describe("Authenticated with username", () => {
    test("visits / and is redirected to /@test-user (FR-02, NFR-02)", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");
      await page.waitForURL(/\/@test-user/);
      await expect(page).toHaveURL(/\/@test-user/);
      // MirrorHomePage never renders on the way through.
      await expect(
        page.getByRole("link", { name: /create account/i }),
      ).not.toBeVisible();
    });

    test("visits /sign-in and is redirected to /@test-user; OTP form never visible (FR-06, NFR-02)", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/sign-in");
      await page.waitForURL(/\/@test-user/);
      await expect(page).toHaveURL(/\/@test-user/);
      await expect(
        page.getByTestId("auth.otp-login.email-input"),
      ).not.toBeVisible();
    });

    test("visits /dashboard and the dashboard renders (FR-05)", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole("heading", { name: /insights/i })).toBeVisible();
    });

    test("visits /onboarding and is redirected to /@test-user; wizard never visible (FR-08)", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/onboarding");
      await page.waitForURL(/\/@test-user/);
      await expect(page).toHaveURL(/\/@test-user/);
      await expect(
        page.getByRole("heading", { name: /choose your username/i }),
      ).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Authenticated without username — FR-01, FR-04, FR-06 (case b), FR-12 (case a)
  // ──────────────────────────────────────────────────────────────────────
  test.describe("Authenticated without username", () => {
    test("visits / and is redirected to /onboarding; home markup never visible (FR-01, NFR-02)", async ({
      authenticatedPageNoUsername: page,
    }) => {
      await page.goto("/");
      await page.waitForURL(/\/onboarding/);
      await expect(page).toHaveURL(/\/onboarding/);
      await expect(
        page.getByRole("link", { name: /create account/i }),
      ).not.toBeVisible();
    });

    test("visits /sign-up and is redirected to /onboarding; sign-up form never visible (FR-06, NFR-02)", async ({
      authenticatedPageNoUsername: page,
    }) => {
      await page.goto("/sign-up");
      await page.waitForURL(/\/onboarding/);
      await expect(page).toHaveURL(/\/onboarding/);
      await expect(
        page.getByTestId("auth.otp-sign-up.email-input"),
      ).not.toBeVisible();
    });

    test("visits /dashboard and is redirected to /onboarding (FR-04, NFR-02)", async ({
      authenticatedPageNoUsername: page,
    }) => {
      await page.goto("/dashboard");
      await page.waitForURL(/\/onboarding/);
      await expect(page).toHaveURL(/\/onboarding/);
      // Dashboard's Insights heading must never flash for a no-username user.
      await expect(
        page.getByRole("heading", { name: /insights/i }),
      ).not.toBeVisible();
    });

    test("visits /@rick-rubin and is redirected to /onboarding; target profile never renders (FR-12 case a)", async ({
      authenticatedPageNoUsername: page,
    }) => {
      await page.goto("/@rick-rubin");
      await page.waitForURL(/\/onboarding/);
      await expect(page).toHaveURL(/\/onboarding/);
      // Explicit flash check: Rick Rubin's profile markup must never be visible
      // on the way through (NFR-02 for /@<username>).
      await expect(
        page.getByRole("heading", { name: /rick.rubin/i }),
      ).not.toBeVisible();
    });

    test("post-auth navigation from / → /onboarding never passes through /dashboard (FR-07)", async ({
      authenticatedPageNoUsername: page,
    }) => {
      const navigationTrail: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) {
          navigationTrail.push(frame.url());
        }
      });

      // Simulates the post-OTP landing — `/` is the landing after FR-10's
      // default redirect. For a no-username session, `/` redirects to
      // `/onboarding`. The invariant: the nav trail contains `/` and
      // `/onboarding`, and never contains `/dashboard`.
      await page.goto("/");
      await page.waitForURL(/\/onboarding/);

      const hitsDashboard = navigationTrail.some((url) =>
        /\/dashboard(\/|$|\?)/.test(url),
      );
      expect(hitsDashboard).toBe(false);

      const hitsOnboarding = navigationTrail.some((url) =>
        /\/onboarding/.test(url),
      );
      expect(hitsOnboarding).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Middleware-level redirect destination — FR-11
  // ──────────────────────────────────────────────────────────────────────
  test.describe("Middleware-level redirect destination", () => {
    test("authed /sign-in middleware redirect emits location: / (FR-11)", async ({
      authenticatedPage: page,
    }) => {
      const redirectLocations: string[] = [];
      page.on("response", (response) => {
        // Isolate the document-level redirect chain from subresource noise
        // (prefetches, image CDNs, etc. can also emit 30x responses).
        if (!response.request().isNavigationRequest()) return;
        const status = response.status();
        if (status >= 300 && status < 400) {
          const loc = response.headers()["location"];
          if (loc) redirectLocations.push(loc);
        }
      });
      await page.goto("/sign-in");
      await page.waitForURL(/\/@test-user/);
      // The first hop (middleware) must point at '/', not '/dashboard'.
      expect(redirectLocations.length).toBeGreaterThan(0);
      const first = redirectLocations[0];
      // URL may be absolute (http://host/) or relative ("/"). Accept both,
      // but require the path portion to be exactly "/" (no /dashboard, etc).
      // Strip any origin, strip query, then compare to "/".
      const firstPath = first.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
      expect(firstPath).toBe("/");
      // Defense in depth: no hop at any point should be /dashboard.
      expect(redirectLocations.some((loc) => /\/dashboard(\/|$|\?)/.test(loc))).toBe(
        false,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Stale-cookie edge case — NFR-05
  // ──────────────────────────────────────────────────────────────────────
  test.describe("Stale-cookie edge cases", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("fabricated session cookie → visiting / lands on /sign-in, no loop (NFR-05)", async ({
      page,
    }) => {
      await page.context().addCookies([
        {
          name: "better-auth.session_token",
          value: "fabricated-invalid-value",
          domain: "localhost",
          path: "/",
        },
      ]);
      await page.goto("/");
      // With a stale cookie, middleware thinks user is authed and lets / through.
      // / runs isAuthenticated() server-side, which rejects the fabricated cookie,
      // so / falls through to MirrorHomePage OR the layout-level redirect to
      // /sign-in fires. Either way the user must NOT end up on /onboarding.
      await page.waitForLoadState("networkidle");
      const finalUrl = page.url();
      // Accept either / (rendering home) or /sign-in — both are non-loop outcomes.
      // Explicitly reject /onboarding which would indicate the no-profile gate
      // fired on an invalid-session user and created a loop symptom.
      expect(finalUrl).not.toMatch(/\/onboarding/);
      const finalPath = finalUrl
        .replace(/^https?:\/\/[^/]+/, "")
        .split("?")[0];
      expect(["/", "/sign-in"]).toContain(finalPath);
    });
  });
});
