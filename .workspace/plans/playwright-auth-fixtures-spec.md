# Mirror: Playwright Auth Fixtures

## Overview

Authenticated E2E tests in Mirror are currently blocked. The app uses OTP and magic-link authentication (no passwords), making UI-based login impractical in test environments. Existing specs either test only unauthenticated flows or use `test.fixme()` stubs with comments explaining the gap (see `e2e/onboarding.spec.ts`).

This feature introduces a **test-only API route** that creates a real Better Auth session cookie for a seeded test user, coupled with a **Playwright fixture** that injects that cookie before test runs. No new runtime dependencies are added. The approach works with the current Better Auth v1.4.9 + `@convex-dev/better-auth 0.10.10` stack without requiring an upgrade.

**Outcome:** Tests for authenticated flows (onboarding, post-upload ownership check, dashboard) run deterministically in CI and locally with `pnpm test:e2e`.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| FR-01 | A `POST /api/auth/test-session` route exists in the Mirror app | P0 | `curl -X POST http://localhost:3001/api/auth/test-session -H "x-test-secret: <secret>"` returns 200 with a `Set-Cookie` header |
| FR-02 | The test-session route is disabled unless `PLAYWRIGHT_TEST_SECRET` env var is set | P0 | Without env var set, route returns 403; with env var set and matching header, returns 200 |
| FR-03 | The test-session route accepts `email` in the request body and a `x-test-secret` request header | P0 | Route signature documented; missing either field returns 400/403 |
| FR-04 | The route calls Better Auth's `emailOTP.sendVerificationOTP` followed immediately by `emailOTP.verifyOTP` with a pre-known OTP value, producing a valid session cookie | P0 | After calling the route, `GET /api/auth/get-session` with the returned cookie responds with a non-null session |
| FR-05 | The OTP used in the test flow is a fixed deterministic value (`000000`) injected via the test-session route's internal flow | P0 | Confirmed by inspecting Better Auth's OTP storage after route call; the stored OTP hash matches `000000` |
| FR-06 | Better Auth's `onCreate` trigger auto-creates the app-level `users` table row when the auth user is created | P0 | After route call, Convex `users` table has a row with `email` matching the test email |
| FR-07 | A Convex `internalMutation` named `ensureTestUser` upserts the test user's app-level profile: sets `username: "test-user"`, `onboardingComplete: true`, `name: "Test User"` | P0 | After calling mutation, querying `users` by `username` returns the expected record |
| FR-08 | The test-session route calls `ensureTestUser` via Convex HTTP action after creating the Better Auth session | P0 | Profile row exists with correct fields before Playwright proceeds |
| FR-09 | A Playwright `auth.setup.ts` global setup project hits `/api/auth/test-session`, captures cookies via `storageState`, and writes `e2e/.auth/user.json` | P0 | File `e2e/.auth/user.json` is created after setup project runs |
| FR-10 | An `authenticated` Playwright fixture extends `base` fixtures, loading `storageState` from `e2e/.auth/user.json` | P0 | Tests using `authenticatedPage` fixture see a valid session cookie in the browser context |
| FR-11 | The Playwright config adds a `setup` project that runs before `authenticated` tests, using project dependencies | P0 | `playwright.config.ts` has a `setup` project with `dependencies: []` and `authenticated` project with `dependencies: ["setup"]` |
| FR-12 | Multiple Playwright workers can safely share the same `storageState` file (read-only cookie reuse) | P0 | Running `pnpm test:e2e --workers=4` produces consistent results |
| FR-13 | The `e2e/.auth/` directory is gitignored | P1 | `apps/mirror/.gitignore` includes `e2e/.auth/` |
| FR-14 | `e2e/onboarding.spec.ts` `test.fixme` tests are converted to real passing tests using the authenticated fixture | P0 | `pnpm test:e2e` runs them without `test.fixme` and they pass |
| FR-15 | `e2e/post-upload.spec.ts` tests that currently use `test.skip` when button is not found are converted to authenticated tests | P0 | All post-upload tests run without conditional skip guards |

### Non-Functional Requirements

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| NFR-01 | No new runtime npm dependencies are added | P0 | Diff of `package.json` for `apps/mirror`, `packages/convex`, and `packages/features` shows no new entries |
| NFR-02 | The test-session route is only reachable when `PLAYWRIGHT_TEST_SECRET` env var is set; production deployments never set this var | P0 | Route source includes env var guard; deployment `.env` files do not include this var |
| NFR-03 | Build passes: `pnpm build --filter=@feel-good/mirror` exits 0 | P0 | Run after all changes |
| NFR-04 | Lint passes: `pnpm lint --filter=@feel-good/mirror` exits 0 | P0 | Run after all changes |
| NFR-05 | Auth setup project completes in under 10 seconds | P1 | Playwright HTML report shows setup project duration |
| NFR-06 | The `PLAYWRIGHT_TEST_SECRET` value in `.env.test` or `.env.local` is never committed to the repository | P0 | `.gitignore` covers `.env*.local`; `.env.test` (if used) documents the pattern without actual value |

---

## Architecture

### Data Flow

```
Playwright global setup (auth.setup.ts)
  |
  |-- POST /api/auth/test-session
  |     Header: x-test-secret: <PLAYWRIGHT_TEST_SECRET>
  |     Body: { email: "playwright-test@mirror.test" }
  |
  |   Route Handler (apps/mirror/app/api/auth/test-session/route.ts)
  |     1. Guard: env PLAYWRIGHT_TEST_SECRET must be set, header must match
  |     2. Call Better Auth HTTP API internally:
  |        a. POST {CONVEX_SITE_URL}/api/auth/email-otp/send-verification-otp
  |           body: { email, type: "sign-in" }
  |           -> Better Auth stores OTP in its internal table
  |        b. PATCH OTP record in Convex to force value to "000000"
  |           (via an internalMutation: forceTestOtp)
  |        c. POST {CONVEX_SITE_URL}/api/auth/sign-in/email-otp
  |           body: { email, otp: "000000" }
  |           -> Better Auth validates OTP, creates session, returns Set-Cookie
  |     3. Pre-warm Convex JWT cookie:
  |        d. POST {CONVEX_SITE_URL}/api/auth/convex/token
  |           (forward better-auth.session_token cookie from step c)
  |           -> Returns convex_jwt cookie needed for SSR Convex queries
  |     4. Call internal Convex mutation: ensureTestUser
  |        -> Upserts app users row: username, name, onboardingComplete: true
  |     5. Forward ALL Set-Cookie headers (both session_token and convex_jwt) to Playwright
  |
  Playwright captures cookies via page.context().storageState()
  Writes to e2e/.auth/user.json
  |
  Authenticated test projects load storageState from e2e/.auth/user.json
  |
  Test navigates to /onboarding -> sees onboarding page (not /sign-in redirect)
  Test navigates to /@test-user/posts -> sees "New" button (is owner)
```

### Files to Create

| File | Purpose |
|------|---------|
| `apps/mirror/app/api/auth/test-session/route.ts` | Test-only POST route. Guards on `PLAYWRIGHT_TEST_SECRET` env var. Drives Better Auth OTP flow internally, forces a deterministic OTP via Convex, forwards session cookie to caller. |
| `apps/mirror/e2e/auth.setup.ts` | Playwright setup project script. Calls `/api/auth/test-session`, saves `storageState` to `e2e/.auth/user.json`. |
| `apps/mirror/e2e/fixtures/auth.ts` | Playwright fixture exporting `authenticatedPage` — a `Page` fixture with `storageState` pre-loaded from `e2e/.auth/user.json`. |
| `packages/convex/convex/auth/testHelpers.ts` | Two `internalMutation` functions: `forceTestOtp` (patches the OTP value to `000000` for a given email) and `ensureTestUser` (upserts app-level user profile for test email). |

### Files to Modify

| File | Change |
|------|--------|
| `apps/mirror/playwright.config.ts` | Add `setup` project (runs `auth.setup.ts`); add `authenticated` project with `dependencies: ["setup"]` and `storageState: "e2e/.auth/user.json"`. Keep existing `chromium` project for unauthenticated tests. |
| `apps/mirror/.gitignore` | Add `e2e/.auth/` to prevent committing session files. |
| `apps/mirror/e2e/onboarding.spec.ts` | Remove `test.fixme` wrappers; import `authenticatedPage` fixture; add `storageState` cookie injection before navigation. |
| `apps/mirror/e2e/post-upload.spec.ts` | Remove `test.skip` guards predicated on owner check; use `authenticatedPage` fixture instead. |
| `packages/convex/convex/http.ts` | Register `testHelpers` as callable from internal HTTP actions if needed for the route to invoke them. (The route invokes via Convex HTTP client, not directly.) |

### Dependencies

None. All required packages are already present:
- `better-auth` — Better Auth client and cookie utilities
- `@convex-dev/better-auth/nextjs` — `convexBetterAuthNextJs` which is already used for `auth-server.ts`
- `convex` — Convex client for server-side mutation calls from the route
- `@playwright/test` — Already installed for e2e tests

### Key Interfaces and Types

```ts
// apps/mirror/app/api/auth/test-session/route.ts

interface TestSessionRequestBody {
  email: string;
}

interface TestSessionResponse {
  ok: boolean;
  username: string; // "test-user"
}

// The route returns: NextResponse with Set-Cookie forwarded from Better Auth

// apps/mirror/e2e/fixtures/auth.ts
import { test as base, type Page } from "@playwright/test";

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";

// packages/convex/convex/auth/testHelpers.ts
// forceTestOtp: internalMutation
// args: { email: v.string() }
// returns: v.null()
// Finds the OTP record for the given email and patches its value to "000000"
// WARNING: Only call from test-session route; never expose as public API

// ensureTestUser: internalMutation
// args: { email: v.string(), username: v.string() }
// returns: v.null()
// Upserts a users row: finds by email, patches username + name + onboardingComplete
// If not found, inserts a new row (in case trigger hasn't fired yet due to async)
```

---

## Implementation Details

### 1. Test-Session API Route

**Location:** `apps/mirror/app/api/auth/test-session/route.ts`

**Guard conditions (checked before any auth work):**
1. `process.env.PLAYWRIGHT_TEST_SECRET` must be set (non-empty string). If absent, return `NextResponse.json({ error: "Not found" }, { status: 404 })` — indistinguishable from a missing route to avoid leaking information.
2. Request header `x-test-secret` must exactly match `process.env.PLAYWRIGHT_TEST_SECRET`. If mismatched, return 403.
3. Request body must contain `email` (non-empty string). If absent, return 400.

**Auth flow (after guards pass):**

Step 1 — Trigger OTP send:
```
POST {NEXT_PUBLIC_CONVEX_SITE_URL}/api/auth/email-otp/send-verification-otp
Content-Type: application/json
{ "email": "<test-email>", "type": "sign-in" }
```
Better Auth stores a hashed OTP in its internal database. The actual OTP is emailed, but we discard it — we will override the stored value next.

Step 2 — Force OTP to `000000`:
Call Convex internal mutation `internal.auth.testHelpers.forceTestOtp` via the Convex HTTP client (using `CONVEX_SITE_URL` and an internal API call pattern). This patches the stored OTP hash to match `000000`.

Implementation note: To call an internal Convex mutation from a Next.js route handler, use the Convex `ConvexHttpClient` with `runMutation` from the generated `internal` API. This requires `CONVEX_URL` (not the site URL) and a Convex deployment key — or alternatively, expose a thin HTTP action on the Convex side that wraps the internal mutation and gates on the same test secret header.

**Recommended pattern:** Add an internal HTTP action in `packages/convex/convex/http.ts` at path `/test/force-otp` gated on the same `PLAYWRIGHT_TEST_SECRET` env var that the Next.js route passes through. This avoids needing a Convex admin key in the Mirror app.

Step 3 — Verify OTP to create session:
```
POST {NEXT_PUBLIC_CONVEX_SITE_URL}/api/auth/sign-in/email-otp
Content-Type: application/json
{ "email": "<test-email>", "otp": "000000" }
```
Better Auth validates the (now overridden) OTP and responds with a `Set-Cookie: better-auth.session_token=...` header.

Step 4 — Ensure test user profile:
Call the `/test/ensure-user` internal HTTP action (same gating pattern as step 2), which calls `internal.auth.testHelpers.ensureTestUser`. This sets `username: "test-user"`, `name: "Test User"`, `onboardingComplete: true` on the app-level users row.

Step 5 — Pre-warm Convex JWT:
After sign-in, POST to `{NEXT_PUBLIC_CONVEX_SITE_URL}/api/auth/convex/token` forwarding the `better-auth.session_token` cookie from Step 3. This triggers `@convex-dev/better-auth` to issue a `convex_jwt` cookie. Collect `set-cookie` headers from this response too.

**Why:** The `convexBetterAuthNextJs` adapter's `getToken()` (called by `isAuthenticated()` in server components) exchanges the session cookie for a Convex JWT via this endpoint. Without the `convex_jwt` cookie pre-warmed, SSR-rendered pages may fail to authenticate Convex queries on first load.

Step 6 — Forward all cookies to Playwright:
Collect the `set-cookie` headers from BOTH the sign-in response (Step 3) and the token response (Step 5) and forward them in the Next.js `NextResponse`. Return `{ ok: true, username: "test-user" }` as the body.

### 2. Convex Internal HTTP Actions for Test Helpers

**Location:** `packages/convex/convex/http.ts` (modify to add two routes, or create `packages/convex/convex/testHttp.ts` and register in `http.ts`)

```ts
// Only registered when PLAYWRIGHT_TEST_SECRET is set
// Guard at handler level, not at registration level (env may not be set at build time)

http.route({
  path: "/test/force-otp",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = req.headers.get("x-test-secret");
    if (!secret || secret !== process.env.PLAYWRIGHT_TEST_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
    const { email } = await req.json() as { email: string };
    await ctx.runMutation(internal.auth.testHelpers.forceTestOtp, { email });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }),
});

http.route({
  path: "/test/ensure-user",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = req.headers.get("x-test-secret");
    if (!secret || secret !== process.env.PLAYWRIGHT_TEST_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
    const { email, username } = await req.json() as { email: string; username: string };
    await ctx.runMutation(internal.auth.testHelpers.ensureTestUser, { email, username });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }),
});
```

**Note:** `PLAYWRIGHT_TEST_SECRET` on the Convex side must be set in the Convex deployment's environment variables. Use `pnpm exec convex env set PLAYWRIGHT_TEST_SECRET <value>` for local dev, and set it in the Convex dashboard for the test deployment.

### 3. Convex `testHelpers.ts` Mutations

**Location:** `packages/convex/convex/auth/testHelpers.ts`

```ts
// forceTestOtp
// Finds the Better Auth OTP record for the given email and patches it to "000000"
// Better Auth stores OTPs via its internal storage in the betterAuth component.
// We access via authComponent's adapter or via direct db query on the component's tables.
```

**Implementation challenge:** Better Auth stores OTPs in its own internal Convex component tables (prefixed with `betterAuth:`), not in the top-level schema. The `authComponent` from `@convex-dev/better-auth` exposes a `runMutation` or similar method to interact with those tables.

Concretely, query the Better Auth component's verification table (the same table the `emailOTP` plugin writes to). The `@convex-dev/better-auth` component exposes its internal mutations via `authComponent`'s context. The pattern:

```ts
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { authComponent } from "./client";

export const forceTestOtp = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Better Auth emailOTP stores verification tokens in the component's
    // verification table. Query via component context.
    // The verification identifier format is: `email-otp:${email}`
    const verifications = await ctx.db
      .query("betterAuth:verifications" as any) // component table
      // ... filter by identifier: `email-otp:${args.email}`
    // Patch the `value` field to the expected OTP hash for "000000"
    // OR: use authComponent.db.patch(ctx, ...) if that API is available
    return null;
  },
});
```

**Open question (see section 9):** The exact API for patching Better Auth's internal component tables is unconfirmed. The implementation agent must inspect `@convex-dev/better-auth` source to find the correct table name and field format. An alternative is to expose the OTP value via an environment hook in `createAuth`'s `emailOTP.sendVerificationOTP` callback — store it in a temporary `testOtpStore` Convex table, then read it back in the verify step.

**Alternative (simpler, no internal table hacking):**

Modify `packages/convex/convex/auth/client.ts`'s `createAuth` function to check for `PLAYWRIGHT_TEST_SECRET` and, when set, use a fixed OTP value in `sendVerificationOTP`:

```ts
emailOTP({
  otpLength: 6,
  expiresIn: 300,
  allowedAttempts: 5,
  sendVerificationOTP: async ({ email, otp, type }) => {
    if (process.env.PLAYWRIGHT_TEST_SECRET && email.endsWith("@mirror.test")) {
      // In test mode: store the OTP in a Convex table for the test route to read back.
      // The OTP here IS the real one Better Auth generated — we just store it.
      void actionCtx.runMutation(internal.auth.testHelpers.storeTestOtp, { email, otp });
      return; // Don't send email
    }
    void actionCtx.runAction(internal.email.actions.sendOTP, { to: email, otp, type });
  },
}),
```

Then the test-session route's Step 2 becomes: `GET /test/read-otp?email=<email>` which returns the stored OTP. The route then uses that real OTP (not a hardcoded `000000`) in Step 3.

**This alternative is strongly preferred** because:
- It doesn't require patching Better Auth's internal component tables
- The OTP is real and valid — no hash collision risk
- No dependency on internal Better Auth table schema

### 4. Playwright Config Changes

**Updated `apps/mirror/playwright.config.ts`:**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    // Setup project: runs auth.setup.ts, creates e2e/.auth/user.json
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // Unauthenticated tests (existing chromium project)
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /auth\.setup\.ts/,
    },

    // Authenticated tests
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testMatch: /.*\.authenticated\.spec\.ts/,
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
  },
});
```

**Test file naming convention:**
- Unauthenticated specs: `*.spec.ts` (existing pattern, no change)
- Authenticated specs: `*.authenticated.spec.ts` (new suffix, matched by `authenticated` project only)

This avoids running authenticated tests in the `chromium` project (which has no session cookie), preventing false failures.

### 5. `auth.setup.ts` Script

**Location:** `apps/mirror/e2e/auth.setup.ts`

```ts
import { test as setup } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate test user", async ({ request }) => {
  const secret = process.env.PLAYWRIGHT_TEST_SECRET;
  if (!secret) {
    throw new Error(
      "PLAYWRIGHT_TEST_SECRET env var is required to run authenticated tests.\n" +
      "Set it in .env.test or .env.local and ensure it matches the Convex deployment."
    );
  }

  const response = await request.post("/api/auth/test-session", {
    headers: { "x-test-secret": secret },
    data: { email: "playwright-test@mirror.test" },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`test-session route failed (${response.status()}): ${body}`);
  }

  // Playwright's APIRequestContext automatically stores cookies set by the response.
  // Save storageState so browser contexts in test projects can reuse the session.
  await request.storageState({ path: authFile });
});
```

### 6. Seed Data: `ensureTestUser` Mutation

**Location:** `packages/convex/convex/auth/testHelpers.ts`

```ts
export const ensureTestUser = internalMutation({
  args: {
    email: v.string(),
    username: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) {
      await ctx.db.patch("users", existing._id, {
        username: args.username,
        name: "Test User",
        onboardingComplete: true,
      });
    } else {
      // Trigger may not have fired yet (async); insert directly
      await ctx.db.insert("users", {
        authId: `test_${args.email}`,
        email: args.email,
        username: args.username,
        name: "Test User",
        onboardingComplete: true,
      });
    }
    return null;
  },
});
```

**Note:** The `users` table must have a `by_email` index. If it does not exist, add it to `convex/schema.ts` for the `users` table: `.index("by_email", ["email"])`. Verify by reading `packages/convex/convex/schema.ts` first — do not add a duplicate.

### 7. Updated `onboarding.spec.ts`

Authenticated tests move to `apps/mirror/e2e/onboarding.authenticated.spec.ts`. The original `onboarding.spec.ts` keeps only unauthenticated tests.

```ts
// e2e/onboarding.authenticated.spec.ts
import { test, expect } from "./fixtures/auth";

test.describe("Onboarding (authenticated)", () => {
  test("shows dashboard when onboardingComplete is true", async ({
    authenticatedPage: page,
  }) => {
    // Test user has onboardingComplete: true — should redirect to dashboard
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/(dashboard|@test-user)/);
  });

  test("no auth errors in console during dashboard page load", async ({
    authenticatedPage: page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    const authErrors = consoleErrors.filter(
      (msg) => msg.includes("Unauthenticated") || msg.includes("ConvexError")
    );
    expect(authErrors).toHaveLength(0);
  });
});
```

**Note on the `test.fixme` scenarios:** The original fixme tests expected `/onboarding` to show a username step. But the seeded test user has `onboardingComplete: true`, so it will redirect away. The correct authenticated onboarding test (username step visible) requires a separate test user with `onboardingComplete: false`. This is an open question — see Section 9.

### 8. Updated `post-upload.spec.ts`

Authenticated upload tests move to `apps/mirror/e2e/post-upload.authenticated.spec.ts`. Tests that require ownership use `authenticatedPage` and navigate using the test user's username.

```ts
// e2e/post-upload.authenticated.spec.ts
import { test, expect } from "./fixtures/auth";
import path from "path";
import fs from "fs";

const username = "test-user"; // matches ensureTestUser's username

// ... (createTempMdFile helper stays the same)

test.describe("Post markdown upload (authenticated)", () => {
  test("New button is visible for post owner", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000); // wait for Convex hydration
    await expect(page.getByTestId("new-post-btn")).toBeVisible();
  });

  test("upload dialog opens and accepts .md file with preview", async ({
    authenticatedPage: page,
  }) => {
    // ... full test body without test.skip guards
  });

  // ... remaining tests from post-upload.spec.ts
});
```

---

## Unit Test Plan

All tests use vitest, `test()` (not `it()`), `.test.ts` suffix, `__tests__/` directories.

| Test File | Test Case | Verifies |
|-----------|-----------|----------|
| `apps/mirror/app/api/auth/test-session/__tests__/route.test.ts` | `test("returns 404 when PLAYWRIGHT_TEST_SECRET not set")` | FR-02 |
| `apps/mirror/app/api/auth/test-session/__tests__/route.test.ts` | `test("returns 403 when x-test-secret header is wrong")` | FR-02 |
| `apps/mirror/app/api/auth/test-session/__tests__/route.test.ts` | `test("returns 400 when email is missing from body")` | FR-03 |
| `packages/convex/convex/auth/__tests__/testHelpers.test.ts` | `test("ensureTestUser inserts new user when not found")` | FR-07 |
| `packages/convex/convex/auth/__tests__/testHelpers.test.ts` | `test("ensureTestUser patches existing user without duplicate insert")` | FR-07 |
| `packages/convex/convex/auth/__tests__/testHelpers.test.ts` | `test("ensureTestUser sets onboardingComplete to true")` | FR-07 |

**Testing the route handler in isolation:** Use `next-test-api-route-handler` or mock the `NextRequest`/`NextResponse` constructors. Alternatively, test only the guard logic by extracting it into a pure `validateTestRequest(request: NextRequest): ValidationResult` function and testing that directly.

---

## Playwright E2E Test Plan

### Auth fixture tests (verify the fixture itself works)

| Spec File | Scenario | Verifies |
|-----------|----------|----------|
| `e2e/auth.setup.ts` | Setup project completes without error | FR-09 |
| `e2e/auth-fixture.authenticated.spec.ts` | Authenticated page navigates to `/dashboard` without redirect to `/sign-in` | FR-10, FR-11 |
| `e2e/auth-fixture.authenticated.spec.ts` | Authenticated page cookie `better-auth.session_token` is present | FR-01, FR-04 |
| `e2e/auth-fixture.authenticated.spec.ts` | `GET /api/auth/get-session` returns non-null session for authenticated page | FR-04 |

### Unblocked tests (previously `test.fixme` or conditionally skipped)

| Spec File | Scenario | Verifies |
|-----------|----------|----------|
| `e2e/onboarding.authenticated.spec.ts` | Authenticated user with `onboardingComplete: true` is not shown onboarding wizard | FR-14 |
| `e2e/onboarding.authenticated.spec.ts` | No auth-related console errors on dashboard page load | FR-14 |
| `e2e/post-upload.authenticated.spec.ts` | "New" button is visible for post owner (no conditional skip) | FR-15 |
| `e2e/post-upload.authenticated.spec.ts` | Upload dialog opens, accepts .md file, shows preview | FR-15 |
| `e2e/post-upload.authenticated.spec.ts` | Fallbacks applied when frontmatter absent | FR-15 |
| `e2e/post-upload.authenticated.spec.ts` | Error shown for non-.md file | FR-15 |
| `e2e/post-upload.authenticated.spec.ts` | Dialog closes when Cancel clicked | FR-15 |

---

## Anti-Patterns to Avoid

| Anti-pattern | Reason |
|---|---|
| Exposing `PLAYWRIGHT_TEST_SECRET` in client-side bundles | The env var must not be prefixed `NEXT_PUBLIC_`. Keep it server-only. |
| Using `test.use({ storageState })` inline in spec files | Leads to duplicated config and inconsistency. Use the `authenticated` Playwright project with centralized `storageState`. |
| Calling `page.route()` to mock auth API responses | Route mocking at the browser level cannot intercept server-component session validation. The session cookie must be real and recognized server-side. |
| Hardcoding `000000` as a magic OTP in Better Auth source | Couples production auth code to test behavior. Use the `storeTestOtp` pattern: intercept in `sendVerificationOTP` callback when email matches test pattern. |
| Patching Better Auth internal component tables directly | Fragile; schema may change across `@convex-dev/better-auth` versions. Use the `sendVerificationOTP` interception approach instead. |
| Sharing a test user who has `onboardingComplete: false` with tests that expect `onboardingComplete: true` | Tests will conflict. Use a single test user with `onboardingComplete: true` for the primary fixture; create a separate fixture or mutation for the onboarding-step tests. |
| Creating `views/` directories inside `apps/mirror/` | File-organization convention: `views/` is only for cross-app packages. |
| Running `globalSetup` instead of Playwright project dependencies | `globalSetup` runs in a separate Node context with no access to Playwright's fixture system. Use `dependencies` instead (available since Playwright v1.31). |
| Committing `e2e/.auth/user.json` | Contains real session tokens. Must be gitignored. |
| Using `setTimeout` to wait for Convex hydration | Use `waitForSelector` or `waitForResponse` targeting specific Convex data. |

---

## Orchestration Plan

Single implementation agent, linear order. All commands run from the monorepo root unless noted.

1. **Read schema** — Read `packages/convex/convex/schema.ts` to confirm whether `users` table has a `by_email` index. If not, add it (requires `pnpm exec convex codegen` after).

2. **Create `testHelpers.ts`** — Write `packages/convex/convex/auth/testHelpers.ts` with `storeTestOtp` and `ensureTestUser` internal mutations.

3. **Modify `createAuth` in `client.ts`** — Add test-mode OTP interception in `emailOTP.sendVerificationOTP`: when `PLAYWRIGHT_TEST_SECRET` is set and email ends with `@mirror.test`, call `internal.auth.testHelpers.storeTestOtp` and skip sending the email.

4. **Add Convex HTTP test actions** — Add `/test/read-otp` and `/test/ensure-user` routes to `packages/convex/convex/http.ts`, each gated on `x-test-secret` header.

5. **Run Convex codegen** — `pnpm exec convex codegen` from the monorepo root (or `packages/convex/`) to regenerate `_generated/api.ts` with the new internal functions.

6. **Create test-session API route** — Write `apps/mirror/app/api/auth/test-session/route.ts` implementing the full flow: guard → send OTP → read OTP from Convex → verify OTP → ensure user profile → forward cookies.

7. **Update `.gitignore`** — Add `e2e/.auth/` to `apps/mirror/.gitignore`.

8. **Update `playwright.config.ts`** — Add `setup` and `authenticated` projects as described in Implementation Details section 4.

9. **Create Playwright fixture** — Write `apps/mirror/e2e/fixtures/auth.ts` exporting `authenticatedPage` fixture.

10. **Create `auth.setup.ts`** — Write `apps/mirror/e2e/auth.setup.ts` as described in Implementation Details section 5.

11. **Set env vars** — Add `PLAYWRIGHT_TEST_SECRET=<local-value>` to `apps/mirror/.env.local` and set same value in Convex dashboard (`pnpm exec convex env set PLAYWRIGHT_TEST_SECRET <local-value>`).

12. **Create `auth-fixture.authenticated.spec.ts`** — Write fixture smoke tests.

13. **Migrate `onboarding.spec.ts`** — Remove fixme tests from the original spec; create `onboarding.authenticated.spec.ts` with the authenticated versions.

14. **Migrate `post-upload.spec.ts`** — Remove conditional skip guards from the original spec (leave unauthenticated tests in place); create `post-upload.authenticated.spec.ts` with authenticated versions using `test-user` username.

15. **Build + lint** — `pnpm build --filter=@feel-good/mirror && pnpm lint --filter=@feel-good/mirror`.

16. **Run tests** — `pnpm --filter=@feel-good/mirror test:e2e`. Verify setup project completes, authenticated tests pass, unauthenticated tests unaffected.

---

## Open Questions

| # | Question | Impact | Suggested Resolution |
|---|----------|--------|----------------------|
| OQ-01 | What is the exact internal table name and field format used by `@convex-dev/better-auth 0.10.10` for `emailOTP` verification storage? | High — needed if using the direct patch approach | Use `storeTestOtp` interception in `sendVerificationOTP` callback instead (avoids touching internal tables entirely) |
| OQ-02 | Does the `users` table already have a `by_email` index, or must one be added? | Medium — affects step 1 of orchestration plan and requires codegen if missing | Implementation agent must read `packages/convex/convex/schema.ts` before writing mutations |
| OQ-03 | Should there be a second fixture for `onboardingIncompleteUser` (i.e., a test user with `onboardingComplete: false`) to enable testing the actual onboarding wizard UI? | Medium — current spec only tests the `onboardingComplete: true` path | Deferred to a follow-up; mark the wizard-step test scenario as `test.fixme` with a note that a second fixture is needed |
| OQ-04 | Should `PLAYWRIGHT_TEST_SECRET` be the same value in both the Next.js app and the Convex deployment, or separate? | Low — they can be the same secret; simpler to rotate together | Use the same value; document in `.env.example` |
| OQ-05 | Does the `ConvexHttpClient` from `convex/browser` work in a Next.js Route Handler, or must we use the Node.js client (`convex` package)? | Low — either should work in server context | Use `ConvexHttpClient` from `convex/browser` (also works server-side); or use the REST-style HTTP action approach which requires no Convex client at all |

---

## Risks and Mitigations

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Better Auth rate-limiting blocks the test-session route (limit: 3 per 60s for email-otp/send) | High | Medium | The test user email `playwright-test@mirror.test` is fixed; re-runs within 60s will hit the rate limit. Mitigation: check if an OTP already exists before calling send; or disable rate limiting for `*.test` emails when `PLAYWRIGHT_TEST_SECRET` is set. |
| `@convex-dev/better-auth` internal OTP storage schema changes across versions, breaking `storeTestOtp` approach | Medium | Low | The `storeTestOtp` approach intercepts at the `sendVerificationOTP` callback level — above the internal storage layer. Only the mutation that writes to a custom `testOtpStore` table needs updating. |
| The test session expires mid-CI run (session expires in 14 days by default) | Low | Very Low | 14-day session expiry is well beyond any CI run duration. If needed, increase session TTL for test emails. |
| Playwright setup project fails silently and `e2e/.auth/user.json` is stale from a previous run | Medium | Low | `auth.setup.ts` should delete and recreate the file each run. Add a `fs.rmSync(authFile, { force: true })` before `storageState()` call. |
| `ensureTestUser` creates a duplicate `users` row if the `onCreate` trigger also fires | Medium | Medium | `ensureTestUser` uses `.unique()` query before insert — if two rows exist (shouldn't happen), it throws, exposing the bug rather than silently ignoring it. The `onCreate` trigger should be idempotent by design. |
| `test-user` username collides with an existing production user | Low | Low | The email `playwright-test@mirror.test` is not a real email domain; username `test-user` may exist. Use a less common username like `playwright-e2e-test-user` or make username configurable via the route body. |
| Adding `/test/*` HTTP routes to the Convex HTTP router in production | Medium | Medium | All `/test/*` routes check `x-test-secret` header at the handler level. Without the header matching `PLAYWRIGHT_TEST_SECRET`, they return 403. Production deployments should never set `PLAYWRIGHT_TEST_SECRET`, making the routes effectively inert. |
