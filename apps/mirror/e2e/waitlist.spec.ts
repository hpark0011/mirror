import { test, expect } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";

import { api } from "@feel-good/convex/convex/_generated/api";

const SUCCESS_COPY = "You're on the list — we'll be in touch.";
const ALREADY_ON_LIST_COPY =
  "Looks like you're already on the list — we'll be in touch.";
const INVALID_EMAIL_COPY = "Please enter a valid email address.";

/**
 * Generates a collision-free `@mirror.test` email per call. Using a unique
 * address per run keeps the E2E idempotent — no DB cleanup, and each run's
 * submission maps to a fresh row.
 */
function uniqueTestEmail(): string {
  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `waitlist-e2e-${slug}@mirror.test`;
}

/**
 * Seeds a waitlist row via the public `submit` mutation over Convex HTTP.
 *
 * Rationale for using the public path rather than the
 * `internal.waitlistRequests.testHelpers.seedWaitlistRow` internal mutation:
 *  - The internal helper is not currently exposed over a `/test/*` HTTP route
 *    (Wave 1 did not add one), so calling it from Playwright would require
 *    Convex admin auth — brittle across dev/preview/prod.
 *  - The public `submit` mutation is idempotent by design (FR-02): it inserts
 *    at most one row per lowercased email, so using it for seeding produces
 *    the exact same DB state as the internal helper.
 *  - Per-email rate limit (3/hour, FR-03) comfortably covers 1 seed + 1 UI
 *    submission per scenario.
 */
async function seedWaitlistEmail(email: string): Promise<void> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL must be set to seed waitlist rows from Playwright",
    );
  }
  const client = new ConvexHttpClient(convexUrl);
  await client.mutation(api.waitlistRequests.mutations.submit, { email });
}

test.describe("Waitlist landing", () => {
  test("renders MIRROR headline, tagline, and waitlist form; no Create account or Sign in buttons (FR-05, FR-10, FR-12)", async ({
    page,
  }) => {
    await page.goto("/");

    // MIRROR headline — format-stable selector per FR-10.
    await expect(page.locator("div.text-2xl.font-medium").first()).toHaveText(
      "MIRROR",
    );

    // Tagline — exact copy, visibility-asserted per FR-10.
    await expect(
      page.getByText("Turn your mind into something others can talk to."),
    ).toBeVisible();

    // Waitlist form controls — FR-05.
    await expect(page.getByTestId("home.waitlist.email-input")).toBeVisible();
    await expect(page.getByTestId("home.waitlist.submit-btn")).toBeVisible();

    // Demoted CTAs must be gone from `/` — FR-12.
    await expect(page.getByText(/create account/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);
  });

  test("happy path: valid email transitions to success panel (FR-06)", async ({
    page,
  }) => {
    await page.goto("/");

    const email = uniqueTestEmail();
    await page.getByTestId("home.waitlist.email-input").fill(email);
    await page.getByTestId("home.waitlist.submit-btn").click();

    const success = page.getByTestId("home.waitlist.success");
    await expect(success).toBeVisible({ timeout: 10000 });
    await expect(success).toHaveText(SUCCESS_COPY);

    // Email input is replaced by the success panel.
    await expect(page.getByTestId("home.waitlist.email-input")).toHaveCount(0);
  });

  test("duplicate email shows already-on-list panel (FR-07)", async ({
    page,
  }) => {
    const email = uniqueTestEmail();

    // Pre-seed the row via Convex HTTP. The public `submit` mutation is
    // idempotent — the second call (from the UI below) will therefore take
    // the already-on-list branch.
    await seedWaitlistEmail(email);

    await page.goto("/");

    await page.getByTestId("home.waitlist.email-input").fill(email);
    await page.getByTestId("home.waitlist.submit-btn").click();

    const alreadyOnList = page.getByTestId("home.waitlist.already-on-list");
    await expect(alreadyOnList).toBeVisible({ timeout: 10000 });
    await expect(alreadyOnList).toHaveText(ALREADY_ON_LIST_COPY);
  });

  test("invalid email rejected client-side via Zod; no server-state panels render (FR-09)", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByTestId("home.waitlist.email-input").fill("not-an-email");
    await page.getByTestId("home.waitlist.submit-btn").click();

    // FormMessage surfaces the Zod error. We assert on the copy rather than a
    // specific selector so the test survives internal FormMessage refactors.
    await expect(page.getByText(INVALID_EMAIL_COPY)).toBeVisible();

    // Positive idle-state assertion first — proves the form is still rendered
    // in its default shape. (A bare `toHaveCount(0)` on a server-state panel
    // would pass trivially if the testid were ever renamed, so we pair it with
    // a must-still-be-true check on the email input and submit button.)
    await expect(page.getByTestId("home.waitlist.email-input")).toBeVisible();
    await expect(page.getByTestId("home.waitlist.submit-btn")).toBeEnabled();

    // None of the server-driven state panels should render — the submit
    // handler never ran. Per the waitlist spec, we do NOT add a request spy
    // here: Convex mutations travel over a WebSocket that Playwright's
    // request observers cannot see, so a "no request fired" assertion at the
    // E2E layer would be false confidence. That invariant is covered at the
    // component-test layer (`waitlist-form.test.tsx`).
    await expect(page.getByTestId("home.waitlist.success")).toHaveCount(0);
    await expect(page.getByTestId("home.waitlist.already-on-list")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("home.waitlist.form-error")).toHaveCount(0);
  });

  test("success state reset link returns form to idle (FR-15)", async ({
    page,
  }) => {
    await page.goto("/");

    const email = uniqueTestEmail();
    await page.getByTestId("home.waitlist.email-input").fill(email);
    await page.getByTestId("home.waitlist.submit-btn").click();

    // Land on success first.
    await expect(page.getByTestId("home.waitlist.success")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("home.waitlist.reset-link").click();

    const emailInput = page.getByTestId("home.waitlist.email-input");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveValue("");
    await expect(page.getByTestId("home.waitlist.submit-btn")).toBeEnabled();
  });

  test("already-on-list state reset link returns form to idle (FR-15)", async ({
    page,
  }) => {
    const email = uniqueTestEmail();
    await seedWaitlistEmail(email);

    await page.goto("/");
    await page.getByTestId("home.waitlist.email-input").fill(email);
    await page.getByTestId("home.waitlist.submit-btn").click();

    // Land on already-on-list state first.
    await expect(page.getByTestId("home.waitlist.already-on-list")).toBeVisible(
      { timeout: 10000 },
    );

    await page.getByTestId("home.waitlist.reset-link").click();

    const emailInput = page.getByTestId("home.waitlist.email-input");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveValue("");
    await expect(page.getByTestId("home.waitlist.submit-btn")).toBeEnabled();
  });

  test("demoted sign-in link navigates to /sign-in (FR-11)", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /already invited/i }).click();

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByTestId("home.waitlist.email-input")).toHaveCount(0);
    await expect(page.getByTestId("auth.otp-login.email-input")).toBeVisible();
  });

  // FR-14 (authenticated redirect from `/` → `/dashboard`) lives in
  // `waitlist.authenticated.spec.ts`. It needs a real Better Auth session,
  // which this repo provisions via the `setup` → `authenticated` Playwright
  // project chain + `e2e/.auth/user.json` storageState. Inline session
  // seeding inside a `chromium`-project test doesn't inherit that
  // machinery.
});
