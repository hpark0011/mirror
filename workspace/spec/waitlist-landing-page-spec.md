# Waitlist Landing Page — Spec

## What the user gets

- When I visit Mirror's home page during the closed beta, the first thing I see is a way to **join the waitlist**, not a "Create account" button that silently rejects me.
- When I drop my email into the form, I get an **immediate, unambiguous confirmation** that I'm on the list — even if I submit twice, the second time I see "you're already on the list" instead of a confusing error.
- When I'm an **already-invited beta tester**, I can still reach the sign-in page — there's a small "Already invited? Sign in" link under the form, so I'm not lost.
- When someone tries to spam the form, they can't exhaust the database or flood the list — the mutation is rate-limited, and malformed emails are rejected before they ever hit the server.
- The **MIRROR headline and tagline stay exactly as they are** — only the CTA under them changes.

## How we'll know it works

| Scenario (user-flow language) | Expected outcome | Test file | Verifies |
| --- | --- | --- | --- |
| A public visitor lands on `/` for the first time | Sees the MIRROR headline, the tagline, an email input, and a "Join Waitlist" button. No "Create account" CTA is visible. | `apps/mirror/e2e/waitlist.spec.ts` | FR-05, FR-10, FR-12 |
| Visitor types a valid email and clicks "Join Waitlist" | Form transitions to a success state showing "You're on the list — we'll be in touch." The email is written to the `waitlistRequests` table (lowercased). | `apps/mirror/e2e/waitlist.spec.ts` | FR-02, FR-06 |
| Visitor submits the same email a second time (from a fresh page load) | Form shows "Looks like you're already on the list — we'll be in touch." No duplicate row is created. | `apps/mirror/e2e/waitlist.spec.ts` | FR-02, FR-07 |
| Visitor types `not-an-email` and clicks submit | Form shows an inline validation error via `FormMessage` before any network call fires. | `apps/mirror/e2e/waitlist.spec.ts` (asserts the error renders); `apps/mirror/features/home/components/__tests__/waitlist-form.test.tsx` (asserts no `useMutation` call — the "no network" half cannot be verified in E2E since Convex travels over WebSocket frames Playwright's `page.on('request')` does not observe; do not add a request spy to the E2E) | FR-09 |
| Visitor hammers the form 10 times in a minute from the same email | After the per-email rate limit is exceeded, the form shows "Please wait a moment before trying again." | `apps/mirror/features/home/components/__tests__/waitlist-form.test.tsx` (Vitest component test — see transport note below) | FR-03, FR-08 |
| After a successful submission, visitor clicks "Use a different email" | Email input reappears and is empty; submit button is re-enabled. | `apps/mirror/e2e/waitlist.spec.ts` | FR-15 |
| An invited beta tester clicks the small "Already invited? Sign in" link under the form | Lands on `/sign-in` with the existing OTP sign-in form visible and unchanged. | `apps/mirror/e2e/waitlist.spec.ts` | FR-11 |
| An already-authenticated user visits `/` | Is redirected to `/dashboard` — the waitlist landing is for signed-out visitors only. | `apps/mirror/e2e/waitlist.spec.ts` | FR-14 |
| A beta tester navigates directly to `/sign-up` | Existing sign-up flow renders unchanged. The home page no longer links there, but the route still works for direct links. | `apps/mirror/e2e/auth.spec.ts`, `apps/mirror/e2e/beta-allowlist.spec.ts` | FR-13 (open question — see below) |

**Transport note (important).** Convex `useMutation` calls travel over a WebSocket (`wss://<deployment>.convex.cloud`) via the Convex sync protocol — not HTTP. Playwright's `page.route` cannot intercept them. Waitlist E2E tests run against a **real dev Convex backend** and seed state through Playwright-mode internal mutations (e.g. `internal.waitlistRequests.testHelpers.seedWaitlistRow`, gated by `PLAYWRIGHT_TEST_SECRET`), mirroring the pattern in `auth.spec.ts`. The existing `beta-allowlist.spec.ts` is the edge case that uses `page.route` successfully — it only works because it mocks Better Auth's HTTP route (`/api/auth/email-otp/send-verification-otp`), which goes through a Next.js proxy. Scenarios that cannot be cleanly produced in E2E (rate-limit rejection, generic transport errors) are covered by the `waitlist-form.test.tsx` Vitest component test that mocks `useMutation` — see the rate-limit row above.

## Requirements

### Functional Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| FR-01 | A new Convex table `waitlistRequests` exists with fields `{ email: string, submittedAt: number }` and a `by_email` index on `["email"]`. | p0 | `pnpm --filter=@feel-good/convex run generate` succeeds; `packages/convex/convex/_generated/dataModel.d.ts` contains `waitlistRequests`; Vitest test `submit inserts one row` writes + reads the table. |
| FR-02 | A public `mutation` named `api.waitlistRequests.mutations.submit` with args `{ email: v.string() }` and returns `v.object({ alreadyOnList: v.boolean() })`. It lowercases+trims the email on write. On an already-listed email it returns `{ alreadyOnList: true }` without inserting a second row. On a new email it inserts exactly one row with `submittedAt = Date.now()` and returns `{ alreadyOnList: false }`. | p0 | Vitest: two back-to-back `submit` calls with the same email result in exactly one `waitlistRequests` row; the second call returns `{ alreadyOnList: true }`. Stored `email` is lowercase. |
| FR-03 | `submit` is rate-limited by `@convex-dev/rate-limiter` with two named limits: `waitlistSubmitPerEmail` (fixed window, 3/hour, keyed by lowercased email) and `waitlistSubmitGlobal` (token bucket, 200/hour, capacity 50, no key). Per-email check runs before the global check. On either rejection, throws `ConvexError` with `{ code: "RATE_LIMIT", retryAfterMs: <number> }`. | p0 | Vitest: 4th submit from the same email within one hour throws `ConvexError` whose `.data.code === "RATE_LIMIT"`; row count in `waitlistRequests` stays at 1 (the first successful insert). `vi.useFakeTimers` advances past the hour and the 5th call succeeds. |
| FR-04 | `submit` runs a minimal server-side sanity check (defense in depth): the normalized email must be non-empty, must contain exactly one `@`, must have at least one character on each side, and must contain a `.` in the domain part. On failure, throws `ConvexError({ code: "INVALID_EMAIL" })`. This is **not** meant to replicate Zod's `.email()` validator — authoritative validation lives in the client Zod schema. The server check only prevents obviously-garbage rows from reaching the table. | p1 | Vitest: `submit({ email: "not-an-email" })` throws `ConvexError` with `.data.code === "INVALID_EMAIL"`; `waitlistRequests` is empty afterwards. |
| FR-05 | `apps/mirror/features/home/components/home-page.tsx` renders a `WaitlistForm` client component in place of the two `<Button>` CTAs (Sign in + Create account). The MIRROR headline and tagline `<div>` / `<p>` above remain present and unchanged. The static `<p className="text-sm">Join Waitlist</p>` is removed (its intent is now the form's submit button label). | p0 | Playwright: `page.goto("/")` shows `data-testid="home.waitlist.email-input"` and `data-testid="home.waitlist.submit-btn"`. `page.getByRole("link", { name: "Sign in" })` and `page.getByRole("link", { name: "Create account" })` both return zero matches on `/`. |
| FR-06 | After a successful submission where `alreadyOnList === false`, the form hides the email input and shows a success panel with the copy "You're on the list — we'll be in touch." tagged with `data-testid="home.waitlist.success"`. | p0 | Playwright: fill + submit a new email → assert `home.waitlist.success` is visible with the exact copy; `home.waitlist.email-input` is no longer visible. |
| FR-07 | After a submission where `alreadyOnList === true`, the form shows "Looks like you're already on the list — we'll be in touch." tagged with `data-testid="home.waitlist.already-on-list"`. This state uses the same visual treatment as success but different copy. | p0 | Playwright: seed a waitlist row via direct Convex mutation, reload `/`, submit the same email → assert `home.waitlist.already-on-list` is visible with the exact copy. |
| FR-08 | When the mutation throws `ConvexError` with `code: "RATE_LIMIT"`, the form shows an inline error with `data-testid="home.waitlist.form-error"` and copy "You've submitted a few times — please try again in a little while." The email input stays visible so the user can retry later. | p0 | Playwright: intercept Convex HTTP with `page.route` and return a body encoding `ConvexError({ code: "RATE_LIMIT", retryAfterMs: 60000 })` → assert `home.waitlist.form-error` shows the exact copy. |
| FR-09 | Client-side Zod validation rejects invalid emails **before** any network call fires. The form shows `FormMessage` with the Zod error "Please enter a valid email address." | p0 | Playwright: spy on requests to `**/*.convex.cloud/**` and `**/api/**`; fill `not-an-email`, click submit → assert zero matching network requests fired and `FormMessage` shows "Please enter a valid email address." |
| FR-10 | The MIRROR headline (`<div className="text-2xl font-medium">MIRROR</div>`) and tagline (`<p className="text-xl">Turn your mind into something others can talk to.</p>`) render unchanged on `/`. | p0 | Playwright: `expect(page.locator('div.text-2xl.font-medium').first()).toHaveText('MIRROR')` and `expect(page.getByText('Turn your mind into something others can talk to.')).toBeVisible()`. Format-stable — survives auto-formatter rewrites. |
| FR-11 | Below the form, a small secondary link with copy "Already invited? Sign in" links to `/sign-in`. It is not styled as a `Button`; it is a plain text link (`<Link className="text-sm text-muted-foreground hover:underline">`) or equivalent muted treatment — clearly demoted relative to the form's submit button. | p0 | Playwright: `page.getByRole("link", { name: /already invited/i })` is visible on `/` and its `href` resolves to `/sign-in`. Clicking it navigates to `/sign-in` and `data-testid="auth.otp-login.email-input"` becomes visible. |
| FR-12 | The home page no longer renders any "Create account" CTA. The `/sign-up` route remains reachable by direct URL (unchanged). | p0 | Playwright: `page.getByText(/create account/i)` returns zero visible matches on `/`. Direct navigation to `/sign-up` still renders `data-testid="auth.otp-sign-up.email-input"` (pre-existing suite passes unchanged). |
| FR-15 | After a successful submission (both `alreadyOnList: true` and `false`), the form shows a small "Use a different email" text link (`data-testid="home.waitlist.reset-link"`) that resets the form back to the idle state with an empty input. | p1 | Playwright: submit → success panel visible → click reset link → email input visible again with empty value; state returns to `"idle"`. |
| FR-13 | The `apps/mirror/e2e/auth.spec.ts` and `apps/mirror/e2e/beta-allowlist.spec.ts` suites continue to pass unchanged. Confirmed-safe coupling: `auth.spec.ts` navigates directly to `/sign-in` / `/sign-up` / `/dashboard` and never navigates from `/`, so removing the `<Button>Sign in</Button>` / `<Button>Create account</Button>` CTAs from the home page cannot break it. `beta-allowlist.spec.ts` likewise operates on `/sign-up` and `/sign-in` directly. | p0 | `pnpm --filter=@feel-good/mirror test:e2e -- auth` and `-- beta-allowlist` both pass. Pre-implementation audit: `grep -n 'page.goto("/")\|page.goto("/?"\|page.goto("/#"' apps/mirror/e2e/auth.spec.ts apps/mirror/e2e/beta-allowlist.spec.ts` returns zero matches. |
| FR-14 | Authenticated users visiting `/` are redirected to `/dashboard` by middleware (no waitlist form for signed-in users). | p0 | `apps/mirror/middleware.ts` — `/` is added to the `AUTH_ROUTES` list (or equivalent branch). Playwright: seed an authenticated session via the Playwright-mode test helpers (see `auth.spec.ts`), `page.goto("/")` → assert final URL is `/dashboard`. |

### Non-functional Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| NFR-01 | The `submit` mutation performs at most **one** `ctx.db.query(...).withIndex(...).unique()` lookup plus at most **one** `ctx.db.insert(...)` per call. No table scans, no N+1. | p1 | Vitest spy on `ctx.db`: after `submit` completes, `ctx.db.query` was called with `"waitlistRequests"` exactly once and `ctx.db.insert` was called at most once. |
| NFR-02 | The rate-limit error does not leak whether the email is already on the list. A hit on the per-email limit returns the same `RATE_LIMIT` `ConvexError` regardless of whether a prior submission succeeded or was also rate-limited. The client copy is identical. | p2 | Vitest: (a) unknown email exceeds per-email limit → `RATE_LIMIT`; (b) already-listed email exceeds per-email limit → `RATE_LIMIT`. Both throws have `.data.code === "RATE_LIMIT"` and the same error shape. Playwright asserts the client renders the same `home.waitlist.form-error` copy for both. |
| NFR-03 | All new form elements expose `data-testid` attributes under the `home.waitlist.*` prefix (`email-input`, `submit-btn`, `success`, `already-on-list`, `form-error`, plus a `reset-link` per FR-15). No test relies on CSS selectors, button text, or DOM structure alone. | p2 | `grep -n 'data-testid="home.waitlist.' apps/mirror/features/home/components/waitlist-form.tsx` returns at least 6 matches, one per listed id. |
| NFR-04 | The form component files live under `apps/mirror/features/home/` following the feature module convention — `components/waitlist-form.tsx` for the UI, `lib/waitlist.schema.ts` for the Zod schema. No new top-level directory is introduced. | p2 | `ls apps/mirror/features/home/components/waitlist-form.tsx apps/mirror/features/home/lib/waitlist.schema.ts` exits 0. |
| NFR-05 | The waitlist table is completely independent of `betaAllowlist` — no cross-writes, no cross-reads. A user on the waitlist is **not** automatically on the allowlist and vice versa. The existing closed-beta auth gates (`triggers.user.onCreate` and `sendVerificationOTP` in `packages/convex/convex/auth/client.ts`) are not modified. | p0 | `git diff main -- packages/convex/convex/auth/` is empty for this spec's implementation; `git diff main -- packages/convex/convex/betaAllowlist/` is empty; `grep -rn 'betaAllowlist' packages/convex/convex/waitlistRequests/` returns zero matches. |

## Architecture

### 1. Components and structure

**Files to create**

| File | Purpose |
| --- | --- |
| `packages/convex/convex/waitlistRequests/schema.ts` | `waitlistRequestsTable` definition with `email`, `submittedAt`, and `by_email` index. |
| `packages/convex/convex/waitlistRequests/mutations.ts` | Public `submit` mutation — Zod-equivalent regex check, two-layer rate limit, idempotent insert. Returns `{ alreadyOnList: boolean }`. |
| `packages/convex/convex/waitlistRequests/queries.ts` | `internalQuery` `listAll` that returns all rows ordered by `_creationTime desc` for dashboard / CLI use. (Not exposed as public query — admins invoke via `npx convex run`.) |
| `packages/convex/convex/waitlistRequests/rateLimits.ts` | `waitlistRateLimiter = new RateLimiter(components.rateLimiter, { waitlistSubmitPerEmail: {...}, waitlistSubmitGlobal: {...} })`. Mirrors `chat/rateLimits.ts`. |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | Vitest — idempotency, lowercase normalization, invalid-email rejection, rate-limit exceeded, rate-limit leakage (NFR-02). Mirrors `betaAllowlist/__tests__/allowlist.test.ts` harness. **Concrete `normalizeConvexGlob` guidance:** copy the helper from `allowlist.test.ts` lines 22–36, and change **only** the two literal `"betaAllowlist"` occurrences to `"waitlistRequests"`. Do not modify the branch conditions (`startsWith("./")` / `startsWith("../") && !startsWith("../../")`) — those correctly route keys that start with `./` (own `__tests__/` dir), `../` (own module root), or `../../` (sibling modules, pass-through). A naive full-replace will keep working; changes beyond those two strings will break sibling-module resolution. |
| `packages/convex/convex/waitlistRequests/testHelpers.ts` | `internalMutation` `seedWaitlistRow({ email, submittedAt? })`. **Two hard guards** (both required, matching `packages/convex/convex/auth/testHelpers.ts` exactly — do not omit either): (1) call `assertTestEmail(args.email)` which rejects any email not ending in `@mirror.test` — prevents a misconfigured caller from writing real user emails to the table; (2) call or check `isPlaywrightTestMode()` / rely on the `PLAYWRIGHT_TEST_SECRET` gate on the `/test/*` HTTP surface. Production Convex deployments **never** have `PLAYWRIGHT_TEST_SECRET` set, per `.claude/rules/auth.md`. |
| `apps/mirror/features/home/components/__tests__/waitlist-form.test.tsx` | Vitest + React Testing Library — mocks `useMutation` to reject with a real `ConvexError({ code: "RATE_LIMIT", retryAfterMs: 60000 })`, asserts `home.waitlist.form-error` renders with the exact copy. Covers the UX branches that E2E can't cleanly drive (rate-limit, generic-error fallback). |
| `apps/mirror/features/home/lib/waitlist.schema.ts` | Zod schema: `waitlistSchema = z.object({ email: z.string().trim().toLowerCase().email("Please enter a valid email address.") })` + `type WaitlistFormValues = z.infer<typeof waitlistSchema>`. |
| `apps/mirror/features/home/components/waitlist-form.tsx` | `"use client"` component. `useForm<WaitlistFormValues>({ resolver: zodResolver(waitlistSchema), defaultValues: { email: "" } })`. `useMutation(api.waitlistRequests.mutations.submit)`. Renders idle form / success / already-on-list / rate-limit-error states via a `status` discriminated-union local state. |
| `apps/mirror/e2e/waitlist.spec.ts` | Playwright specs for the 7 scenarios in **How we'll know it works**. Uses `page.route` for the rate-limit scenario; uses the Playwright-mode convex client seeding pattern (see `beta-allowlist.spec.ts`) for the duplicate-submission scenario. |

**Files to modify**

| File | Change |
| --- | --- |
| `packages/convex/convex/schema.ts` | Import `waitlistRequestsTable` and register it on `defineSchema` — `waitlistRequests: waitlistRequestsTable`. Mirrors the existing `betaAllowlist` entry on line 16. |
| `packages/convex/vitest.config.ts` | Add `"convex/waitlistRequests/**/*.test.ts"` to the `include` array on line 15–18. |
| `apps/mirror/features/home/components/home-page.tsx` | Replace the two `<Button>` blocks (lines 17–28) and the static `<p>Join Waitlist</p>` (line 14) with `<WaitlistForm />` and an "Already invited? Sign in" `<Link>`. Keep the MIRROR headline `<div>` (line 8–10) and tagline `<p>` (lines 11–13) unchanged. Add `import { WaitlistForm } from "./waitlist-form"`. |
| `apps/mirror/middleware.ts` | **Two changes that must both land:** (a) add `/` to the `AUTH_ROUTES` array on line 5, so authenticated users hitting `/` are redirected to `/dashboard` by the existing check on line 19. (b) **Verify `/` remains in `PUBLIC_ROUTES`** on line 4 — do not remove it. An unauthenticated visit to `/` must fall through both redirect checks (not in `AUTH_ROUTES` for auth'd users only; still in `PUBLIC_ROUTES` so unauth'd users aren't bounced to `/sign-in` by the line 24–28 branch). Removing `/` from `PUBLIC_ROUTES` would lock the public landing page entirely — silent footgun, no compiler error. |
| `apps/mirror/features/home/index.ts` | No export needed — `WaitlistForm` is private to the home feature. |

**Dependencies to add**

None. `@convex-dev/rate-limiter` is already installed and registered in `packages/convex/convex.config.ts`. `react-hook-form`, `@hookform/resolvers/zod`, and `zod` are already direct dependencies of `apps/mirror` (used by `onboarding/components/username-step.tsx`). `@feel-good/ui/primitives/form` exports `Form`, `FormField`, `FormItem`, `FormControl`, `FormMessage`.

### 2. How data flows

End-to-end trace of a single successful submission:

1. **Browser (`/`).** `home-page.tsx` (server component) renders the MIRROR headline + tagline, then mounts `<WaitlistForm />` (client component).
2. **Client form init.** `WaitlistForm` calls `useForm<WaitlistFormValues>({ resolver: zodResolver(waitlistSchema) })` and `useMutation(api.waitlistRequests.mutations.submit)`. Local `status` state starts as `"idle"`.
3. **User types email + clicks "Join Waitlist".** React Hook Form invokes `zodResolver`, which runs `waitlistSchema.parse`. Zod normalizes (`.trim().toLowerCase()`) and validates the email. If invalid, `FormMessage` renders the Zod error message and the submit handler does not run. **No network call fires** (FR-09).
4. **Form submit handler.** Handler calls `await submit({ email: values.email })` where `submit` is the `useMutation` return value.
5. **Network → Convex mutation.** Convex routes to `waitlistRequests/mutations.ts::submit`.
6. **Server input validation (defense in depth).** Handler normalizes `args.email.trim().toLowerCase()`. If the regex check fails, throws `ConvexError({ code: "INVALID_EMAIL" })` (FR-04).
7. **Rate limit — per email.** `waitlistRateLimiter.limit(ctx, "waitlistSubmitPerEmail", { key: normalized, throws: false })`. If `!result.ok`, throws `ConvexError({ code: "RATE_LIMIT", retryAfterMs: result.retryAfter })`.
8. **Rate limit — global.** Same pattern, no `key`. Runs second, only consumed when per-email passes (mirrors `chat/mutations.ts` ordering — the rate-limiter component does not consume a token on rejection, so the ordering is safe).
9. **Idempotent insert.** `ctx.db.query("waitlistRequests").withIndex("by_email", q => q.eq("email", normalized)).unique()`. If a row exists, return `{ alreadyOnList: true }` without insert. Otherwise `ctx.db.insert("waitlistRequests", { email: normalized, submittedAt: Date.now() })` and return `{ alreadyOnList: false }`.
10. **Client response.** `WaitlistForm` receives `{ alreadyOnList }`. On `false` → set local `status` to `"success"` and render the success panel (FR-06). On `true` → `"already-on-list"` panel (FR-07).
11. **Error paths — concrete catch block.** `ConvexError` is imported from `"convex/values"` (matching `chat/mutations.ts` line 1). The catch uses **duck-typing on `err.data.code`**, not `instanceof ConvexError`, because `instanceof` relies on prototype identity and can silently fail if pnpm ever ends up with two copies of the `convex` package in the client bundle (not happening today, but the failure mode is silent — the rate-limit copy would never render). Duck-typing is robust to that.

```typescript
// inside onSubmit:
try {
  const { alreadyOnList } = await submit({ email: values.email });
  setStatus(alreadyOnList ? "already-on-list" : "success");
} catch (err) {
  const code =
    typeof err === "object" &&
    err !== null &&
    "data" in err &&
    typeof (err as { data?: unknown }).data === "object" &&
    (err as { data?: { code?: unknown } }).data?.code;
  if (code === "RATE_LIMIT") {
    setStatus("rate-limit");
  } else {
    setStatus("error");
  }
}
```

`ConvexError.data` is serialized end-to-end by Convex and arrives on the client intact — verified by the existing `chat/mutations.ts` + `use-chat-stream.ts` pattern in this repo. `INVALID_EMAIL` from the server is not user-visible in practice (client Zod blocks it first); if it does leak through, it falls to the generic `"error"` branch with a "Something went wrong, please try again." copy. Step 3's e2e should include a smoke test (4 real submits against the dev backend) that confirms the rate-limit copy renders — a belt-and-suspenders check for the `data.code` discrimination.

Trust boundary: the submit mutation is **public** (not `internalMutation`) and is called directly from an unauthenticated browser. The server-side regex + rate limits are the only enforcement — the Zod schema on the client is UX-only.

### 3. Why this works

**Invariants preserved.**

- The closed-beta auth gate is untouched (NFR-05). `triggers.user.onCreate` and `sendVerificationOTP` in `packages/convex/convex/auth/client.ts` still fire on every user-creation path; joining the waitlist does **not** grant signup access. An unlisted user who joins the waitlist and then navigates to `/sign-up` still gets `BETA_CLOSED`. This is intentional — the waitlist is a capture surface, not a grant.
- The `/sign-in` route behavior is unchanged (FR-13). Existing beta testers have exactly the same sign-in flow they had before.
- Email lowercasing is enforced at two layers (Zod `.toLowerCase()` on the client, `args.email.trim().toLowerCase()` on the server) so the `by_email` index is always queried against a normalized value — the same invariant `betaAllowlist` relies on.

**Classes of bugs made impossible.**

- **Dead-end UX on closed beta.** Before this spec, a public visitor who clicked "Create account" and typed any email would be silently rejected with a "Sign-ups are currently invite-only" error — wasted motion. After this spec, the home page's primary CTA does the thing the user actually can do (join the list), and the invite-only gate is only reachable by someone who navigates to `/sign-up` intentionally.
- **Duplicate waitlist rows.** The `by_email` index + idempotent insert mean that any number of resubmissions produce at most one row per lowercased email, forever. No unique-constraint error, no cleanup mutation needed.
- **Unbounded form spam.** Two-layer rate limit keys on both the user-supplied email (prevents spamming the same row) and a global bucket (prevents an attacker rotating emails from filling the table). The per-email limit is cheap and obvious; the global bucket is the real abuse floor.
- **Enumeration of existing waitlist members.** NFR-02 pins the `RATE_LIMIT` error shape to be identical for listed and unlisted emails, so an attacker can't probe the list by submission-and-timing.

**Why this approach over alternatives.**

- **Public mutation vs HTTP action.** A public mutation is simpler — no HTTP action, no Convex-site URL to plumb, no CORS. The browser client already talks to `api.*` over the existing WebSocket. Rate-limiter works identically.
- **Per-feature table vs shoving into `betaAllowlist`.** Keeping `waitlistRequests` separate from `betaAllowlist` keeps the authoritative closed-beta gate legible. Mixing "wants access" (waitlist) with "has access" (allowlist) in one table would require a status column and make the `isEmailAllowed` query answer a fundamentally different question.
- **Client-side Zod + server-side regex vs Zod-only.** Zod-only would be a trust-boundary violation: the mutation is callable directly over Convex RPC bypassing any client code. Regex duplication is the smallest safe server-side check.

**What existing behavior is guaranteed unchanged.**

- Auth: no changes to `packages/convex/convex/auth/**`, verified by NFR-05's `git diff` check.
- Beta allowlist: no changes to `packages/convex/convex/betaAllowlist/**`, same.
- Home page headline + tagline: byte-identical per FR-10's grep checks.
- `/sign-in` and `/sign-up` routes: covered by FR-13 re-running the pre-existing `auth.spec.ts` + `beta-allowlist.spec.ts` suites.

### 4. Edge cases and gotchas

- **`/sign-up` is now unreferenced from the home page, but still live.** Anyone with a direct `/sign-up` URL still reaches the sign-up form and still hits the `BETA_CLOSED` error on unlisted emails. This is intentional (beta users may have been sent direct links) and is called out in **Open Question #1**.
- **Rate-limit DoS cost — honest accounting.** Per-email rate limit is keyed by the lowercased email the caller submits. An attacker can submit `foo+1@a.com`, `foo+2@a.com`, etc., each getting a fresh per-email bucket. The global token bucket is the backstop, but it is not free: with capacity 50 and refill 200/hour, an attacker can burn the 50-capacity burst in seconds using 50 unique emails. During the ~50 minutes it takes to refill, **legitimate submissions from any email hit `RATE_LIMIT`**. Cost of a 50-minute denial-of-service: 50 attacker requests. This is v1's accepted posture — the waitlist is not safety-critical and a 50-minute stall recovers automatically. A follow-up ticket should add IP-based rate limiting at a Next.js edge route that forwards to Convex (`apps/mirror/app/api/waitlist/route.ts`) so the key is an IP, not user-supplied email. Not in this spec's scope.
- **Server email check vs client Zod validator drift.** The client uses Zod's `.email()` method, which internally delegates to `validator.js`'s `isEmail` — **not** a simple exportable regex. The server-side check in FR-04 is therefore deliberately **not** a clone of Zod's logic; it's a minimal sanity check (non-empty, exactly one `@`, domain has a `.`). This is correct posture: authoritative validation is client-side Zod, and the server check only catches obviously-garbage inputs that bypass the client (direct RPC calls). Expect the two validators to disagree on exotic edge cases (e.g. `"a@b"` passes the server check but fails Zod). The resulting UX is that such inputs are blocked client-side and never reach the server — net-safe.
- **Rate-limiter rejection ordering.** Per the `chat/mutations.ts` note (which verified the `@convex-dev/rate-limiter@0.3.2` source), a failed rate-limit check does **not** consume a token. So running `waitlistSubmitPerEmail` before `waitlistSubmitGlobal` is safe: a per-email rejection leaves the global bucket untouched. Do NOT reverse the order thinking it's equivalent — reversing would let an attacker drain the global bucket by hammering a single rate-limited email.
- **Playwright transport reality.** Convex `useMutation` calls travel over a **WebSocket**, not HTTP — `page.route` cannot intercept them. The E2E strategy in this spec runs against a real dev Convex backend and seeds state via `internal.waitlistRequests.testHelpers.seedWaitlistRow` (gated by `PLAYWRIGHT_TEST_SECRET`). Rate-limit and generic-error UX branches that cannot be cleanly reproduced in E2E are covered by a component-level Vitest test (`waitlist-form.test.tsx`) that mocks `useMutation`. See the transport note under §How we'll know it works for details.
- **`vi.useFakeTimers` and the rate-limiter component — verify before relying on.** The Vitest test for "rate-limit clears after 1 hour" uses `vi.setSystemTime` to advance past the window. It is **not** verified in this repo that `vi.setSystemTime` propagates into the `@convex-dev/rate-limiter` component's internal `Date.now()` calls under `convex-test`. Implementer must write a small spike first: set `vi.useFakeTimers()`, call `submit` once, advance by 1 hour, call `submit` again, assert second call succeeds. If the spike fails, **drop the "rate-limit clears" assertion** from the Vitest suite — it's not our code's invariant to prove, it's the rate-limiter component's. Keep only the "4th call in the window rejects" assertion.
- **First-request latency under rate-limiter cold start.** The `@convex-dev/rate-limiter` component stores bucket state in the component's own tables. First-ever call per bucket name has an extra write; after that it's a patch. Negligible for a human-typed email form, but call out if this mutation ever gets called from an automated system.
- **Success state reset affordance (FR-15).** The success and already-on-list panels include a small "Use a different email" link (`home.waitlist.reset-link`) that resets `status` to `"idle"` and clears the form. Addresses the typo-recovery gap that would otherwise require a full page reload. Both success states get the link; the rate-limit error state keeps the input visible so no reset is needed.

## Unit Tests

| Test File | Test Case | Verifies |
| --- | --- | --- |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | `submit` inserts exactly one row; re-submitting the same email returns `{ alreadyOnList: true }` and leaves the row count at 1 | FR-02 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | `submit` stores email lowercased: input `"MiXeD@CaSe.com"` → stored as `"mixed@case.com"` | FR-02 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | `submit` with invalid email (`"not-an-email"`) throws `ConvexError` with `.data.code === "INVALID_EMAIL"`; table remains empty | FR-04 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | 4th `submit` from the same email within one hour throws `ConvexError` with `.data.code === "RATE_LIMIT"` | FR-03 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | Per-email rate-limit rejection has the same error shape whether the email is already on the list or not (NFR-02 enumeration leak) | NFR-02 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | Spied `ctx.db` shows at most 1 `query("waitlistRequests")` call and at most 1 `insert` call per `submit` invocation | NFR-01 |
| `apps/mirror/features/home/components/__tests__/waitlist-form.test.tsx` | `WaitlistForm` with a `useMutation` that rejects `new ConvexError({ code: "RATE_LIMIT", retryAfterMs: 60000 })` renders `home.waitlist.form-error` with exact copy "You've submitted a few times — please try again in a little while." | FR-08 |
| `apps/mirror/features/home/components/__tests__/waitlist-form.test.tsx` | `WaitlistForm` with a `useMutation` that rejects a plain `Error("network")` renders the generic error copy "Something went wrong, please try again." — not the rate-limit copy. | FR-08 |
| `apps/mirror/features/home/components/__tests__/waitlist-form.test.tsx` | Filling `"not-an-email"` and submitting triggers zero `useMutation` invocations (client Zod blocks before network); `FormMessage` shows "Please enter a valid email address." | FR-09 |

The Vitest harness must mirror `betaAllowlist/__tests__/allowlist.test.ts`: the `normalizeConvexGlob` helper (lines 22–36) is retargeted at `waitlistRequests`, env vars are stubbed at the top of the file before any Convex import, and `convexTest(schema, modules)` is wrapped in a `makeT()` helper.

## Team Orchestration Plan

Reviewer selection and wave packaging happen at execution time — see `.claude/skills/orchestrate-implementation/SKILL.md`.

```
Step 1 — Convex waitlistRequests module + rate limits + tests + Playwright-mode helper
Suggested executor: general
Scope:
  (a) create packages/convex/convex/waitlistRequests/{schema.ts, mutations.ts, queries.ts, rateLimits.ts, testHelpers.ts}.
  (b) create packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts. Copy the normalizeConvexGlob helper from betaAllowlist/__tests__/allowlist.test.ts lines 22–36, changing ONLY the two literal "betaAllowlist" strings to "waitlistRequests" — do NOT modify the branch conditions.
  (c) register waitlistRequestsTable in packages/convex/convex/schema.ts (mirror the betaAllowlist line).
  (d) update packages/convex/vitest.config.ts: add "convex/waitlistRequests/**/*.test.ts" to the include array AND update the comment on line 14 to reflect the widened scope.
  (e) BEFORE writing the "rate-limit clears after window" assertion, write a one-line spike: call submit, vi.setSystemTime(+1hr), call submit again — if the second call is still rate-limited, the fake-timer does not propagate into @convex-dev/rate-limiter under convex-test. Drop that assertion and document why. Keep the "4th call rejects" assertion regardless.
Hard gate:
  pnpm --filter=@feel-good/convex run generate
  pnpm --filter=@feel-good/convex test -- waitlistRequests
Verifies: FR-01, FR-02, FR-03, FR-04, NFR-01, NFR-02, NFR-05
```

```
Step 2 — Home page form + Zod schema + demoted sign-in link + middleware redirect
Suggested executor: general
Scope:
  (a) create apps/mirror/features/home/lib/waitlist.schema.ts exporting waitlistSchema and WaitlistFormValues type.
  (b) create apps/mirror/features/home/components/waitlist-form.tsx — "use client", react-hook-form + zodResolver + useMutation(api.waitlistRequests.mutations.submit). Discriminated-union local status: "idle" | "success" | "already-on-list" | "rate-limit" | "error". Catch block per Architecture §2 step 11 (import ConvexError from "convex/values"). Success + already-on-list states render a "Use a different email" reset link (FR-15).
  (c) create apps/mirror/features/home/components/__tests__/waitlist-form.test.tsx (Vitest + React Testing Library) — FR-08 coverage.
  (d) edit apps/mirror/features/home/components/home-page.tsx — remove lines 14 (static Join Waitlist p) and 17–28 (two Button blocks). Add <WaitlistForm /> and <Link href="/sign-in" className="text-sm text-muted-foreground hover:underline">Already invited? Sign in</Link>. Keep lines 8–13 (MIRROR + tagline) unchanged.
  (e) edit apps/mirror/middleware.ts — add "/" to the AUTH_ROUTES array on line 5 so authenticated users are redirected to /dashboard (FR-14).
  (f) add data-testid attributes: home.waitlist.{email-input, submit-btn, success, already-on-list, form-error, reset-link}.
Hard gate:
  pnpm --filter=@feel-good/mirror build
  pnpm --filter=@feel-good/mirror lint
  grep -n 'data-testid="home.waitlist.' apps/mirror/features/home/components/waitlist-form.tsx
  pnpm --filter=@feel-good/mirror test:e2e -- auth
  pnpm --filter=@feel-good/mirror test:e2e -- beta-allowlist
Verifies: FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, NFR-03, NFR-04
```

```
Step 3 — Playwright e2e coverage
Suggested executor: playwright-browser-agent
Scope: apps/mirror/e2e/waitlist.spec.ts covering all eight scenarios in the E2E table. Runs against the real dev backend (transport is WebSocket; page.route won't intercept). Duplicate-submission scenario uses internal.waitlistRequests.testHelpers.seedWaitlistRow (gated by PLAYWRIGHT_TEST_SECRET, same pattern as testOtpStore). Authenticated-redirect scenario uses the existing Playwright auth helper.
Hard gate:
  pnpm --filter=@feel-good/mirror test:e2e -- waitlist
  pnpm --filter=@feel-good/mirror test:e2e -- auth
  pnpm --filter=@feel-good/mirror test:e2e -- beta-allowlist
Verifies: FR-05, FR-06, FR-07, FR-09, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15
```

```
Step 4 — Full verification
Suggested executor: general
Scope: re-run full build + lint + tests across affected packages; no code changes unless a regression is found. Confirm git diff scope matches NFR-05 (no auth/betaAllowlist diff).
Hard gate:
  pnpm --filter=@feel-good/mirror build
  pnpm --filter=@feel-good/mirror lint
  pnpm --filter=@feel-good/convex test
  pnpm --filter=@feel-good/mirror test:e2e
  git diff --stat main -- packages/convex/convex/auth packages/convex/convex/betaAllowlist
Verifies: all FR + NFR
```

## Open Questions

1. **What happens to `/sign-up`?** Three options, pick one before implementation:
   - **(a) Leave it live and unchanged.** Direct-link invited users can still reach it; unlisted users get the existing `BETA_CLOSED` error on submit. Pros: zero risk to existing invite flow. Cons: a stray link somewhere on the public internet could still drop a public visitor into a dead-end. **Recommended for v1.**
   - **(b) 307-redirect `/sign-up` → `/`.** Forces everyone through the waitlist-first experience. Pros: single front door. Cons: breaks any "sign up here: https://greymirror.ai/sign-up" messages that invited beta users have in their inbox. Requires updating the invitation email templates if any exist.
   - **(c) Keep `/sign-up` live but add an invite-only banner at the top of the form.** Compromise — direct links still work, stray visitors see expectations clearly. Pros: best UX. Cons: small extra work inside the auth feature package, slightly out of scope for a "home page" ticket.
2. **Admin surface for the waitlist.** Is a queryable list of waitlist requests in scope for this ticket? If yes, add an `internalQuery` `listAll` (stubbed in Step 1 scope above) and document `npx convex run waitlistRequests/queries:listAll '{}'` in `.claude/rules/auth.md` (same pattern as the existing `addAllowlistEntry` CLI invocation — `npx convex run` does accept `module/file:name` syntax for internal functions, verified against the existing auth rule). If no, drop the query file and revisit later. **Recommended:** ship the internal query for dashboard visibility; zero UI cost.
3. **Confirmation email to waitlist submitters.** Should we send a "thanks, you're on the list" email via Resend? Out of v1 scope per the user's stated requirements, but worth capturing as a follow-up ticket once the waitlist feature is live and we're ready to batch-onboard from it.

**Resolved during Phase 4 (previously listed as open questions):**

- _Authenticated users on `/`_ — **Resolved:** middleware redirects authenticated users from `/` to `/dashboard`. Captured as FR-14.
- _Email regex sharing between client and server_ — **Resolved:** dropped. Zod's `.email()` does not use a regex (it delegates to `validator.js`). The server-side check in FR-04 is a deliberately minimal sanity check, not a replica of client validation. See Architecture §4 "Server email check vs client Zod validator drift."

## Adversarial Review Summary

Stop reason: **quality bar met** after two critique rounds + two targeted revision passes. Round 2 surfaced no re-raised concerns from round 1, and all round-2 Critical / Important findings are resolved below.

| Concern | Severity | Resolution |
| --- | --- | --- |
| `page.route` cannot intercept Convex mutation responses — transport is WebSocket, not HTTP POST | Critical | **Accepted** — rewrote the Playwright table with a transport note. E2E now runs against real dev backend with Playwright-mode seeded rows (new `testHelpers.ts` + `seedWaitlistRow` internal mutation). Rate-limit UX coverage moved to a component-level Vitest test. |
| `ConvexError` with nested `data` needs explicit catch-block discrimination on the client | Critical | **Accepted** — added a concrete code sketch to Architecture §2 step 11, including the correct `ConvexError` import from `"convex/values"` (matching `chat/mutations.ts` line 1), type-narrowed access to `err.data.code`, and a generic fallback. |
| `normalizeConvexGlob` copy-paste footgun — naive string replace could break sibling-module resolution | Critical | **Accepted** — added explicit rewrite guidance to the `waitlist.test.ts` entry: change ONLY the two literal `"betaAllowlist"` strings, leave branch conditions untouched. Same guidance echoed in Step 1 of the orchestration plan. |
| Global rate-limit bucket is cheaply DoS-able (~50 attacker requests buy ~50 min denial) | Important | **Accepted** — Architecture §4 now states the cost honestly and names IP-based rate limiting at a Next.js edge route as the follow-up. v1 posture unchanged. |
| FR-10 grep verification is fragile against auto-formatters and doesn't prove "unchanged" | Important | **Accepted** — replaced with Playwright `toHaveText('MIRROR')` on `div.text-2xl.font-medium` and `getByText('Turn your mind …').toBeVisible()`. Format-stable and rendering-accurate. |
| FR-13 "existing suites unchanged" claim needed explicit coupling audit | Important | **Accepted** — verification column now cites the `auth.spec.ts` and `beta-allowlist.spec.ts` navigation pattern (direct `/sign-in` and `/sign-up` gotos, never from `/`) and provides a grep command to re-verify. |
| Authenticated users on `/` would see the waitlist form — real UX bug, not "harmless" | Important | **Accepted** — committed to middleware redirect (new FR-14). Open Question #4 resolved and struck. |
| Email regex "shared between client and server" is a false claim — Zod `.email()` doesn't expose a regex | Important | **Accepted** — FR-04 rewritten to describe a minimal server-side sanity check (not a Zod replica). Architecture §4 explains why drift is safe. Open Question #5 resolved and struck. |
| NFR-03 grep command targets a directory without `-r` | Minor | **Accepted** — verification now targets `waitlist-form.tsx` explicitly. |
| `vi.useFakeTimers` may not propagate into rate-limiter component under `convex-test` | Minor | **Accepted** — dropped the "rate-limit clears after window" assertion from the Vitest plan; Step 1 orchestration requires a pre-write spike and documents the fallback. The "4th call rejects" assertion is retained. |
| `npx convex run` path syntax doesn't work for `internalQuery` | Minor | **Rejected** — the existing `.claude/rules/auth.md` documents `npx convex run betaAllowlist/mutations:addAllowlistEntry` for an existing `internalMutation`, proving the syntax does work for internal functions. Claim was incorrect. |
| `vitest.config.ts` comment will drift after adding `waitlistRequests` | Minor | **Accepted** — Step 1 scope now explicitly calls out updating the comment alongside the array entry. |
| Success state has no reset affordance — "can submit again" is false without a page reload | Minor | **Accepted** — added FR-15 and a `home.waitlist.reset-link` test id; success/already-on-list panels render a "Use a different email" link that returns state to `"idle"`. |
| **Round 2: FR-14 middleware change under-specified — implementer could accidentally remove `/` from `PUBLIC_ROUTES` and lock out public visitors** | Critical | **Accepted** — middleware file-modification entry now explicitly states both requirements: (a) add `/` to `AUTH_ROUTES`, (b) keep `/` in `PUBLIC_ROUTES`. The failure mode (silent lockout) is documented in the entry. |
| **Round 2: `seedWaitlistRow` under-specified — without `assertTestEmail`, a misconfigured caller could write real-looking emails to the table** | Critical | **Accepted** — `testHelpers.ts` file entry now requires both guards explicitly: `assertTestEmail` (rejects non-`@mirror.test`) and the `PLAYWRIGHT_TEST_SECRET` gate. Mirrors `auth/testHelpers.ts` exactly, spelled out rather than implied. |
| **Round 2: FR-09 E2E `page.on('request')` spy won't catch WebSocket frames — false confidence** | Important | **Accepted** — dropped the request spy. FR-09 E2E now only asserts observable UI (validation message visible, no success/error panels). The "no network call" invariant is proven at the unit layer via a new `waitlist-form.test.tsx` assertion that `useMutation` is never invoked on invalid input. |
| **Round 2: Rate-limit copy "Please wait a moment" understates a 1-hour wait and will cause support tickets** | Important | **Accepted** — copy changed everywhere to "You've submitted a few times — please try again in a little while." Softens the implied-moment framing without hard-coding a duration the user can't verify. |
| **Round 2: Step 2 hard gate missing `auth.spec.ts` + `beta-allowlist.spec.ts` — regressions from home/middleware changes would be deferred to Step 3** | Important | **Accepted** — Step 2 hard gate now includes both existing E2E suites; Step 2 "Verifies" list now includes FR-13. Regressions are caught immediately rather than in a later wave. |
| **Round 2: `err instanceof ConvexError` can silently fail across bundler module-duplication boundaries** | Important | **Accepted** — catch-block sketch rewritten to use duck-typing on `err.data.code` with no `instanceof`. Added a belt-and-suspenders smoke-test note for Step 3 that verifies the rate-limit copy actually renders against the real dev backend. |
