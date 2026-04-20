# Waitlist Landing Page — Spec

## What the user gets

- When I visit Mirror's home page during the closed beta, the first thing I see is a way to **join the waitlist**, not a "Create account" button that silently rejects me.
- When I drop my email into the form, I get an **immediate, unambiguous confirmation** that I'm on the list — even if I submit twice, the second time I see "you're already on the list" instead of a confusing error.
- When I'm an **already-invited beta tester**, I can still reach the sign-in page — there's a small "Already invited? Sign in" link under the form, so I'm not lost.
- When someone tries to spam the form, they can't exhaust the database or flood the list — the mutation is rate-limited, and malformed emails are rejected before they ever hit the server.
- The **MIRROR headline and tagline stay exactly as they are** — only the CTA under them changes.

## How we'll know it works

| Scenario (user-flow language) | Expected outcome | Verifies |
| --- | --- | --- |
| A public visitor lands on `/` for the first time | Sees the MIRROR headline, the tagline, an email input, and a "Join Waitlist" button. No "Create account" CTA is visible. | FR-05, FR-10, FR-12 |
| Visitor types a valid email and clicks "Join Waitlist" | Form transitions to a success state showing "You're on the list — we'll be in touch." The email is written to the `waitlistRequests` table (lowercased). | FR-02, FR-06 |
| Visitor submits the same email a second time (from a fresh page load) | Form shows "Looks like you're already on the list — we'll be in touch." No duplicate row is created. | FR-02, FR-07 |
| Visitor types `not-an-email` and clicks submit | Form shows an inline validation error via `FormMessage` before any network call fires. | FR-09 |
| Visitor hammers the form 10 times in a minute from the same email | After the per-email rate limit is exceeded, the form shows "Please wait a moment before trying again." | FR-03, FR-08 |
| An invited beta tester clicks the small "Already invited? Sign in" link under the form | Lands on `/sign-in` with the existing OTP sign-in form visible and unchanged. | FR-11 |
| A beta tester navigates directly to `/sign-up` | Existing sign-up flow renders unchanged. The home page no longer links there, but the route still works for direct links. | FR-13 (open question — see below) |

## Requirements

### Functional Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| FR-01 | A new Convex table `waitlistRequests` exists with fields `{ email: string, submittedAt: number }` and a `by_email` index on `["email"]`. | p0 | `pnpm --filter=@feel-good/convex run generate` succeeds; `packages/convex/convex/_generated/dataModel.d.ts` contains `waitlistRequests`; Vitest test `submit inserts one row` writes + reads the table. |
| FR-02 | A public `mutation` named `api.waitlistRequests.mutations.submit` with args `{ email: v.string() }` and returns `v.object({ alreadyOnList: v.boolean() })`. It lowercases+trims the email on write. On an already-listed email it returns `{ alreadyOnList: true }` without inserting a second row. On a new email it inserts exactly one row with `submittedAt = Date.now()` and returns `{ alreadyOnList: false }`. | p0 | Vitest: two back-to-back `submit` calls with the same email result in exactly one `waitlistRequests` row; the second call returns `{ alreadyOnList: true }`. Stored `email` is lowercase. |
| FR-03 | `submit` is rate-limited by `@convex-dev/rate-limiter` with two named limits: `waitlistSubmitPerEmail` (fixed window, 3/hour, keyed by lowercased email) and `waitlistSubmitGlobal` (token bucket, 200/hour, capacity 50, no key). Per-email check runs before the global check. On either rejection, throws `ConvexError` with `{ code: "RATE_LIMIT", retryAfterMs: <number> }`. | p0 | Vitest: 4th submit from the same email within one hour throws `ConvexError` whose `.data.code === "RATE_LIMIT"`; row count in `waitlistRequests` stays at 1 (the first successful insert). `vi.useFakeTimers` advances past the hour and the 5th call succeeds. |
| FR-04 | `submit` rejects malformed emails server-side (defense in depth) with `ConvexError({ code: "INVALID_EMAIL" })`. The regex is the same one the client-side Zod schema uses. | p1 | Vitest: `submit({ email: "not-an-email" })` throws `ConvexError` with `.data.code === "INVALID_EMAIL"`; `waitlistRequests` is empty afterwards. |
| FR-05 | `apps/mirror/features/home/components/home-page.tsx` renders a `WaitlistForm` client component in place of the two `<Button>` CTAs (Sign in + Create account). The MIRROR headline and tagline `<div>` / `<p>` above remain present and unchanged. The static `<p className="text-sm">Join Waitlist</p>` is removed (its intent is now the form's submit button label). | p0 | Playwright: `page.goto("/")` shows `data-testid="home.waitlist.email-input"` and `data-testid="home.waitlist.submit-btn"`. `page.getByRole("link", { name: "Sign in" })` and `page.getByRole("link", { name: "Create account" })` both return zero matches on `/`. |
| FR-06 | After a successful submission where `alreadyOnList === false`, the form hides the email input and shows a success panel with the copy "You're on the list — we'll be in touch." tagged with `data-testid="home.waitlist.success"`. | p0 | Playwright: fill + submit a new email → assert `home.waitlist.success` is visible with the exact copy; `home.waitlist.email-input` is no longer visible. |
| FR-07 | After a submission where `alreadyOnList === true`, the form shows "Looks like you're already on the list — we'll be in touch." tagged with `data-testid="home.waitlist.already-on-list"`. This state uses the same visual treatment as success but different copy. | p0 | Playwright: seed a waitlist row via direct Convex mutation, reload `/`, submit the same email → assert `home.waitlist.already-on-list` is visible with the exact copy. |
| FR-08 | When the mutation throws `ConvexError` with `code: "RATE_LIMIT"`, the form shows an inline error with `data-testid="home.waitlist.form-error"` and copy "Please wait a moment before trying again." The email input stays visible so the user can retry later. | p0 | Playwright: intercept Convex HTTP with `page.route` and return a body encoding `ConvexError({ code: "RATE_LIMIT", retryAfterMs: 60000 })` → assert `home.waitlist.form-error` shows the exact copy. |
| FR-09 | Client-side Zod validation rejects invalid emails **before** any network call fires. The form shows `FormMessage` with the Zod error "Please enter a valid email address." | p0 | Playwright: spy on requests to `**/*.convex.cloud/**` and `**/api/**`; fill `not-an-email`, click submit → assert zero matching network requests fired and `FormMessage` shows "Please enter a valid email address." |
| FR-10 | The MIRROR headline (`<div className="text-2xl font-medium">MIRROR</div>`) and tagline (`<p className="text-xl">Turn your mind into something others can talk to.</p>`) remain byte-identical to today's implementation. | p0 | `grep -n 'MIRROR' apps/mirror/features/home/components/home-page.tsx` returns the unchanged line; `grep -n 'Turn your mind into something others can talk to.' …` returns the unchanged line; visual comparison via Playwright shows both strings present on `/`. |
| FR-11 | Below the form, a small secondary link with copy "Already invited? Sign in" links to `/sign-in`. It is not styled as a `Button`; it is a plain text link (`<Link className="text-sm text-muted-foreground hover:underline">`) or equivalent muted treatment — clearly demoted relative to the form's submit button. | p0 | Playwright: `page.getByRole("link", { name: /already invited/i })` is visible on `/` and its `href` resolves to `/sign-in`. Clicking it navigates to `/sign-in` and `data-testid="auth.otp-login.email-input"` becomes visible. |
| FR-12 | The home page no longer renders any "Create account" CTA. The `/sign-up` route remains reachable by direct URL (unchanged). | p0 | Playwright: `page.getByText(/create account/i)` returns zero visible matches on `/`. Direct navigation to `/sign-up` still renders `data-testid="auth.otp-sign-up.email-input"` (pre-existing suite passes unchanged). |
| FR-13 | The `apps/mirror/e2e/auth.spec.ts` and `apps/mirror/e2e/beta-allowlist.spec.ts` suites continue to pass unchanged — the `/sign-in` and `/sign-up` routes behave exactly as before. | p0 | `pnpm --filter=@feel-good/mirror test:e2e -- auth` and `-- beta-allowlist` both pass. |

### Non-functional Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| NFR-01 | The `submit` mutation performs at most **one** `ctx.db.query(...).withIndex(...).unique()` lookup plus at most **one** `ctx.db.insert(...)` per call. No table scans, no N+1. | p1 | Vitest spy on `ctx.db`: after `submit` completes, `ctx.db.query` was called with `"waitlistRequests"` exactly once and `ctx.db.insert` was called at most once. |
| NFR-02 | The rate-limit error does not leak whether the email is already on the list. A hit on the per-email limit returns the same `RATE_LIMIT` `ConvexError` regardless of whether a prior submission succeeded or was also rate-limited. The client copy is identical. | p2 | Vitest: (a) unknown email exceeds per-email limit → `RATE_LIMIT`; (b) already-listed email exceeds per-email limit → `RATE_LIMIT`. Both throws have `.data.code === "RATE_LIMIT"` and the same error shape. Playwright asserts the client renders the same `home.waitlist.form-error` copy for both. |
| NFR-03 | All new form elements expose `data-testid` attributes under the `home.waitlist.*` prefix (`email-input`, `submit-btn`, `success`, `already-on-list`, `form-error`). No test relies on CSS selectors, button text, or DOM structure alone. | p2 | `grep -n 'data-testid="home.waitlist.' apps/mirror/features/home/components/` returns at least 5 matches, one per listed id. |
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
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | Vitest — idempotency, lowercase normalization, invalid-email rejection, rate-limit exceeded, rate-limit leakage (NFR-02). Mirrors `betaAllowlist/__tests__/allowlist.test.ts` harness exactly (including the `normalizeConvexGlob` helper retargeted at `waitlistRequests`). |
| `apps/mirror/features/home/lib/waitlist.schema.ts` | Zod schema: `waitlistSchema = z.object({ email: z.string().trim().toLowerCase().email("Please enter a valid email address.") })` + `type WaitlistFormValues = z.infer<typeof waitlistSchema>`. |
| `apps/mirror/features/home/components/waitlist-form.tsx` | `"use client"` component. `useForm<WaitlistFormValues>({ resolver: zodResolver(waitlistSchema), defaultValues: { email: "" } })`. `useMutation(api.waitlistRequests.mutations.submit)`. Renders idle form / success / already-on-list / rate-limit-error states via a `status` discriminated-union local state. |
| `apps/mirror/e2e/waitlist.spec.ts` | Playwright specs for the 7 scenarios in **How we'll know it works**. Uses `page.route` for the rate-limit scenario; uses the Playwright-mode convex client seeding pattern (see `beta-allowlist.spec.ts`) for the duplicate-submission scenario. |

**Files to modify**

| File | Change |
| --- | --- |
| `packages/convex/convex/schema.ts` | Import `waitlistRequestsTable` and register it on `defineSchema` — `waitlistRequests: waitlistRequestsTable`. Mirrors the existing `betaAllowlist` entry on line 16. |
| `packages/convex/vitest.config.ts` | Add `"convex/waitlistRequests/**/*.test.ts"` to the `include` array on line 15–18. |
| `apps/mirror/features/home/components/home-page.tsx` | Replace the two `<Button>` blocks (lines 17–28) and the static `<p>Join Waitlist</p>` (line 14) with `<WaitlistForm />` and an "Already invited? Sign in" `<Link>`. Keep the MIRROR headline `<div>` (line 8–10) and tagline `<p>` (lines 11–13) byte-identical. Add `import { WaitlistForm } from "./waitlist-form"`. |
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
11. **Error paths.** `ConvexError` with `code: "RATE_LIMIT"` → set local `status` to `"rate-limit"` and render `home.waitlist.form-error`. Any other error → `"error"` with a generic "Something went wrong, please try again." copy. `INVALID_EMAIL` from the server is not user-visible in practice (client Zod blocks it first) — render the same generic error as the last-resort fallback.

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
- **Authenticated users on `/`.** Middleware does NOT redirect authenticated users away from `/` today (see `apps/mirror/middleware.ts` line 4 — `/` is in `PUBLIC_ROUTES`, not `AUTH_ROUTES`). A signed-in beta user who navigates back to `/` will see the waitlist form, which is weird. **Open Question #4** — decide whether to add `/` to the auth redirect list. v1 accepts the current behavior (signed-in users rarely return to `/`).
- **Rate-limit key rotation.** Per-email rate limit is keyed by the lowercased email the caller submits. An attacker can submit `foo+1@a.com`, `foo+2@a.com`, etc., each getting a fresh per-email bucket. The global bucket (200/hour, capacity 50) is the backstop — if an attacker spins up 50 fresh plus-addressed emails in seconds, the global bucket drains and subsequent submissions reject regardless of email. **This is v1's posture.** A follow-up could add IP-based limiting via a Next.js route that forwards to Convex, but that's out of scope.
- **Server-regex drift from client-Zod.** FR-04 says the server regex "is the same one the client-side Zod schema uses." Implementation approach: export a single `EMAIL_REGEX` constant from `apps/mirror/features/home/lib/waitlist.schema.ts` and re-import it in `packages/convex/convex/waitlistRequests/mutations.ts`. **Caveat:** cross-package imports from `packages/convex` into `apps/mirror` are not allowed. Instead, define `EMAIL_REGEX` in a small shared location — either co-located in both files (with a comment pointing at the other) OR (preferred) add a `packages/utils/email.ts` export consumed by both. If pnpm workspace resolution makes that annoying, duplicate the regex and add a Vitest assertion that both regexes produce the same verdict on a fixed test corpus of 10 valid + 10 invalid strings.
- **Rate-limiter rejection ordering.** Per the `chat/mutations.ts` note (which verified the `@convex-dev/rate-limiter@0.3.2` source), a failed rate-limit check does **not** consume a token. So running `waitlistSubmitPerEmail` before `waitlistSubmitGlobal` is safe: a per-email rejection leaves the global bucket untouched. Do NOT reverse the order thinking it's equivalent — reversing would let an attacker drain the global bucket by hammering a single rate-limited email.
- **Playwright-mode seeding for the duplicate-submission test.** `beta-allowlist.spec.ts` mocks Convex HTTP rather than talking to a real dev backend. The duplicate-submission e2e scenario needs **either** (a) a real Convex dev deployment running under `PLAYWRIGHT_TEST_SECRET`, seeded via an internal mutation before the test, **or** (b) two `page.route` mocks chained — first call returns `{ alreadyOnList: false }`, second call returns `{ alreadyOnList: true }`. Approach (b) is simpler and matches the existing Playwright style; approach (a) is more integration-honest but requires infrastructure already documented but not used by the beta-allowlist spec. **v1 picks (b)**, and the Vitest unit tests cover the true idempotency at the DB layer.
- **First-request latency under rate-limiter cold start.** The `@convex-dev/rate-limiter` component stores bucket state in the component's own tables. First-ever call per bucket name has an extra write; after that it's a patch. Negligible for a human-typed email form, but call out if this mutation ever gets called from an automated system.
- **Success state is not dismissible.** By design — once a user submits, we hide the input and do not offer an "edit email" affordance. Rationale: the waitlist is append-only from the user's POV; if they made a typo they can submit again and both emails will be on the list. Harmless for v1; an admin can clean up during manual invitation.

## Unit Tests

| Test File | Test Case | Verifies |
| --- | --- | --- |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | `submit` inserts exactly one row; re-submitting the same email returns `{ alreadyOnList: true }` and leaves the row count at 1 | FR-02 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | `submit` stores email lowercased: input `"MiXeD@CaSe.com"` → stored as `"mixed@case.com"` | FR-02 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | `submit` with invalid email (`"not-an-email"`) throws `ConvexError` with `.data.code === "INVALID_EMAIL"`; table remains empty | FR-04 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | 4th `submit` from the same email within one hour throws `ConvexError` with `.data.code === "RATE_LIMIT"`; `vi.setSystemTime` past the hour and the 5th call succeeds | FR-03 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | Per-email rate-limit rejection has the same error shape whether the email is already on the list or not (NFR-02 enumeration leak) | NFR-02 |
| `packages/convex/convex/waitlistRequests/__tests__/waitlist.test.ts` | Spied `ctx.db` shows at most 1 `query("waitlistRequests")` call and at most 1 `insert` call per `submit` invocation | NFR-01 |

The Vitest harness must mirror `betaAllowlist/__tests__/allowlist.test.ts`: the `normalizeConvexGlob` helper (lines 22–36) is retargeted at `waitlistRequests`, env vars are stubbed at the top of the file before any Convex import, and `convexTest(schema, modules)` is wrapped in a `makeT()` helper.

## Playwright E2E Tests

| Test File | Scenario | Verifies |
| --- | --- | --- |
| `apps/mirror/e2e/waitlist.spec.ts` | Visit `/`. Assert MIRROR headline and tagline visible; `home.waitlist.email-input` and `home.waitlist.submit-btn` visible; no "Create account" text, no "Sign in" button (only the demoted link). | FR-05, FR-10, FR-12 |
| `apps/mirror/e2e/waitlist.spec.ts` | Fill `home.waitlist.email-input` with a fresh email and submit. Success panel `home.waitlist.success` appears with exact copy "You're on the list — we'll be in touch." Input is no longer visible. | FR-06 |
| `apps/mirror/e2e/waitlist.spec.ts` | `page.route` the submit mutation to return `{ alreadyOnList: true }`. Submit → `home.waitlist.already-on-list` appears with exact copy "Looks like you're already on the list — we'll be in touch." | FR-07 |
| `apps/mirror/e2e/waitlist.spec.ts` | Fill `home.waitlist.email-input` with `"not-an-email"` and submit. Assert zero `page.waitForRequest` matches for Convex mutation paths; `FormMessage` shows "Please enter a valid email address." | FR-09 |
| `apps/mirror/e2e/waitlist.spec.ts` | `page.route` the submit mutation to return a `ConvexError` body with `code: "RATE_LIMIT"`. Submit → `home.waitlist.form-error` shows "Please wait a moment before trying again." Input is still visible. | FR-03, FR-08 |
| `apps/mirror/e2e/waitlist.spec.ts` | Visit `/`. Locate the "Already invited? Sign in" link by role + text. Click it → land on `/sign-in` with `auth.otp-login.email-input` visible. | FR-11 |
| `apps/mirror/e2e/auth.spec.ts` + `apps/mirror/e2e/beta-allowlist.spec.ts` | Pre-existing suites pass unchanged. | FR-13 |

## Team Orchestration Plan

Reviewer selection and wave packaging happen at execution time — see `.claude/skills/orchestrate-implementation/SKILL.md`.

```
Step 1 — Convex waitlistRequests module + rate limits + tests
Suggested executor: general
Scope: create packages/convex/convex/waitlistRequests/{schema.ts,mutations.ts,queries.ts,rateLimits.ts,__tests__/waitlist.test.ts}; register waitlistRequestsTable in packages/convex/convex/schema.ts; add "convex/waitlistRequests/**/*.test.ts" to packages/convex/vitest.config.ts include list.
Hard gate:
  pnpm --filter=@feel-good/convex run generate
  pnpm --filter=@feel-good/convex test -- waitlistRequests
Verifies: FR-01, FR-02, FR-03, FR-04, NFR-01, NFR-02, NFR-05
```

```
Step 2 — Home page form + Zod schema + demoted sign-in link
Suggested executor: general
Scope:
  (a) create apps/mirror/features/home/lib/waitlist.schema.ts exporting waitlistSchema + EMAIL_REGEX.
  (b) create apps/mirror/features/home/components/waitlist-form.tsx — "use client", react-hook-form + zodResolver + useMutation(api.waitlistRequests.mutations.submit); discriminated-union local status for idle/success/already-on-list/rate-limit/error.
  (c) edit apps/mirror/features/home/components/home-page.tsx — remove lines 14 (static Join Waitlist p) and 17–28 (two Button blocks). Add <WaitlistForm /> and <Link href="/sign-in" className="text-sm text-muted-foreground hover:underline">Already invited? Sign in</Link>. Keep lines 8–13 (MIRROR + tagline) byte-identical.
  (d) add data-testid attributes: home.waitlist.{email-input,submit-btn,success,already-on-list,form-error}.
Hard gate:
  pnpm --filter=@feel-good/mirror build
  pnpm --filter=@feel-good/mirror lint
  grep -n 'MIRROR' apps/mirror/features/home/components/home-page.tsx
  grep -n 'Turn your mind into something others can talk to.' apps/mirror/features/home/components/home-page.tsx
  grep -n 'data-testid="home.waitlist.' apps/mirror/features/home/components/waitlist-form.tsx
Verifies: FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, NFR-03, NFR-04
```

```
Step 3 — Playwright e2e coverage
Suggested executor: playwright-browser-agent
Scope: apps/mirror/e2e/waitlist.spec.ts covering all seven scenarios in the E2E table. Use page.route for the duplicate, rate-limit, and invalid-email scenarios; happy path runs against the real dev backend (via Playwright-mode seeding) or against a mocked success response, whichever matches the existing suite style.
Hard gate:
  pnpm --filter=@feel-good/mirror test:e2e -- waitlist
  pnpm --filter=@feel-good/mirror test:e2e -- auth
  pnpm --filter=@feel-good/mirror test:e2e -- beta-allowlist
Verifies: FR-05 through FR-13
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
2. **Admin surface for the waitlist.** Is a queryable list of waitlist requests in scope for this ticket? If yes, add an `internalQuery` `listAll` (stubbed in Step 1 scope above) and document `npx convex run waitlistRequests/queries:listAll` in `.claude/rules/auth.md`. If no, drop the query file and revisit later. **Recommended:** ship the internal query for dashboard visibility; zero UI cost.
3. **Confirmation email to waitlist submitters.** Should we send a "thanks, you're on the list" email via Resend? Out of v1 scope per the user's stated requirements, but worth capturing as a follow-up ticket once the waitlist feature is live and we're ready to batch-onboard from it.
4. **Authenticated users on `/`.** Middleware today allows signed-in users to see `/` and therefore the waitlist form. Should `/` be added to `AUTH_ROUTES` so signed-in users are redirected to `/dashboard`? **Recommended:** leave as-is — changing middleware is a separate concern and the current behavior is harmless (signed-in users would click through to `/dashboard` via their own navigation).
5. **Email regex sharing between client and server.** Two valid approaches (documented in Architecture §4): export from a shared location vs duplicate with a cross-referencing comment. Pick one before Step 1 starts.

## Adversarial Review Summary

_Populated in Phase 4._

| Concern | Severity | Resolution |
| --- | --- | --- |
| _TBD_ | — | — |
