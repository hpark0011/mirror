# Auth Routing Rules for Logged-In Users — Spec

_Worktree: `.worktrees/feature-redirect-to-dashboard`. Branch: `feature-redirect-to-dashboard`._

---

## What the user gets

- When I visit Mirror's home page while already signed in, I land on my own profile instead of the generic sign-up splash.
- If I haven't finished setting up my profile yet, Mirror always takes me to onboarding so I can pick a username before doing anything else — including when I try to open someone else's profile by URL.
- If I try to open the sign-in or sign-up page while already signed in, Mirror skips past it — I never see those forms a second time.
- I can visit `/dashboard` directly when I want insights, and Mirror keeps me there instead of bouncing me back to my profile.
- If I navigate to `/dashboard` or any other in-app route before I've picked a username, Mirror puts onboarding first — I can't skip it by URL-hacking.

## How we'll know it works

| Scenario (user-flow language) | Expected outcome | Verifies |
| --- | --- | --- |
| Returning user with a username visits `/` | Browser URL becomes `/@<username>`; profile page renders | FR-02 |
| Brand-new user who just verified their OTP lands at `/` | Browser URL becomes `/onboarding`; onboarding wizard renders; no hop through `/dashboard` along the way | FR-01, FR-07 |
| Logged-out visitor opens `/` | Sign-in / Create account buttons render; no redirect | FR-03 |
| Signed-in user (with username) clicks a stale `/sign-in` bookmark | Browser ends on `/@<username>`; the sign-in form never flashes | FR-06 |
| Signed-in user (no username yet) types `/sign-up` into URL bar | Browser ends on `/onboarding`; the sign-up form never flashes | FR-06 |
| User with username types `/dashboard` in URL bar | Dashboard (Insights) renders; URL stays `/dashboard` | FR-05 |
| User without username types `/dashboard` in URL bar | Browser becomes `/onboarding`; wizard renders | FR-04 |
| Signed-in user without a username opens a share-link to someone else's `/@rick-rubin` | Browser becomes `/onboarding`; the other user's profile never renders | FR-12 |
| Signed-out visitor opens the same `/@rick-rubin` share-link | Rick Rubin's public profile renders normally; no redirect | FR-12 |
| User finishes onboarding step 2 | Browser becomes `/@<username>`; URL never passes through `/dashboard` | FR-09 |
| User with username reloads `/onboarding` | Browser becomes `/@<username>`; wizard never flashes | FR-08 |
| User with an invalid/expired session cookie visits `/` | Browser ends on `/sign-in` (not `/onboarding`) — no infinite loop | NFR-05 |

## Requirements

### Functional Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| FR-01 | Authenticated user without a username who requests `/` is server-redirected to `/onboarding` before any HTML is sent | P0 | Playwright `auth-routing.spec.ts` — visit `/` with an authed no-username session, assert response status is 307/308 with `location: /onboarding` header, final URL is `/onboarding`, and the `MirrorHomePage` markup never appears in the DOM |
| FR-02 | Authenticated user with a username who requests `/` is server-redirected to `/@<username>` | P0 | Playwright — visit `/` with authed username session, assert final URL is `/@<username>`, `MirrorHomePage` never visible |
| FR-03 | Unauthenticated user on `/` continues to see the existing `MirrorHomePage` landing (Sign in + Create account buttons) | P0 | Playwright — visit `/` without cookie, assert "Sign in" + "Create account" buttons visible |
| FR-04 | Authenticated user without a username who requests any `(protected)` route (today: `/dashboard`) is server-redirected to `/onboarding`. `/onboarding` itself is NOT under `(protected)` after this change — see Architecture §1 | P0 | Playwright — visit `/dashboard` with authed no-username session, assert final URL is `/onboarding`. NFR-07 covers the structural invariant that guarantees this scales to future protected routes |
| FR-05 | Authenticated user with a username who requests `/dashboard` sees the Dashboard Insights page render; no redirect to `/@<username>` occurs | P0 | Playwright — visit `/dashboard` with authed username session, assert final URL is `/dashboard` and "Insights" text visible |
| FR-06 | Authenticated user who requests `/sign-in` or `/sign-up` is redirected: to `/@<username>` if they have a username, or to `/onboarding` if they don't. They never see the auth form | P0 | Playwright — two cases: (a) authed+username → `/sign-in` lands on `/@<username>`; (b) authed+no-username → `/sign-up` lands on `/onboarding`. In both, the OTP email input is never visible |
| FR-07 | After successful OTP signup or signin, the browser's post-auth landing is `/` (not `/dashboard`), and `/`'s server-side logic then routes per FR-01 / FR-02. The navigation history must NOT include a `/dashboard` hop | P0 | Vitest — `getSafeRedirectUrl(undefined)` returns `"/"`. Playwright — complete OTP signup e2e; attach `page.on('framenavigated')` listener; assert the captured URL trail contains `/sign-up`, `/`, `/onboarding` and does NOT contain `/dashboard` |
| FR-08 | Authenticated user with `username && onboardingComplete` who requests `/onboarding` is server-redirected to `/@<username>` before the wizard HTML is sent | P0 | Playwright — visit `/onboarding` with authed+onboardingComplete session, assert response 302/307 → `/@<username>` (no wizard flash) |
| FR-09 | Client-side redirect in `onboarding-wizard.tsx` remains as a safety net so the transition from step 2 complete → `/@<username>` is seamless (Convex reactivity fires before the page reload). The wizard code is not modified; only the page-level server gate (FR-08) is added | P0 | Existing e2e coverage in `onboarding.authenticated.spec.ts` (updated) asserts wizard completion ends on `/@<username>` without passing through `/dashboard` |
| FR-10 | `getSafeRedirectUrl`'s default fallback in `packages/features/auth/utils/validate-redirect.ts` changes from `"/dashboard"` to `"/"` | P0 | Vitest — `getSafeRedirectUrl(null)` returns `"/"`; `getSafeRedirectUrl("")` returns `"/"`; `getSafeRedirectUrl("/somewhere")` returns `"/somewhere"`; `getSafeRedirectUrl("https://evil.com/x")` returns `"/"` |
| FR-11 | `apps/mirror/middleware.ts` redirects authenticated hits on `/sign-in` or `/sign-up` to `/` (not `/dashboard`) | P0 | Playwright — visit `/sign-in` with authed session; via `page.on('response')` capture the first redirect response; assert its `location` header is `/` |
| FR-12 | Authenticated user without a username who requests any `/@<any-username>` public profile route is server-redirected to `/onboarding` before the profile HTML is sent. Unauthenticated visitors continue to see the profile as normal (no gate change for logged-out users) | P0 | Playwright — two cases: (a) authed no-username session visits `/@rick-rubin` → final URL is `/onboarding`, Rick Rubin's profile markup never visible; (b) unauth'd visitor on `/@rick-rubin` → profile renders, no redirect |

### Non-functional Requirements

| ID | Requirement | Priority | Verification |
| --- | --- | --- | --- |
| NFR-01 | `apps/mirror/middleware.ts` makes no outbound HTTP / Convex calls — stays on the Edge runtime (pure cookie read) | P0 | `grep -E '^import' apps/mirror/middleware.ts` returns exactly two lines, for `next/server` and `better-auth/cookies`, and nothing else. Enforced as a CI assertion (script or a single-line Vitest). Any new import triggers review. |
| NFR-02 | Server-side redirects (`redirect()` from `next/navigation`) are preferred over `router.replace` / `window.location` wherever the redirect is deterministic from the server — no client-side flash of forms on `/`, `/sign-in`, `/sign-up`, `/dashboard`, or `/onboarding` for already-routed users | P0 | Playwright — on each of the 5 routes above, assert the redirected-away UI text is never visible (no "Sign in" button during authed `/` redirect, no OTP input during authed `/sign-in` redirect, etc.) |
| NFR-03 | No existing test asserts `/dashboard` as a post-auth landing or as the post-onboarding destination after this change | P0 | `grep -rn "dashboard" apps/mirror/e2e/` — every remaining match is either (a) a test that explicitly navigates to `/dashboard` as a user action (FR-05) or (b) a test of middleware unauth redirect behavior. Three known files flagged for update: `auth.spec.ts`, `onboarding.authenticated.spec.ts`, `auth-fixture.authenticated.spec.ts` |
| NFR-04 | `/dashboard` has no auto-redirect to `/@<username>` — removed from `apps/mirror/app/(protected)/dashboard/layout.tsx` | P0 | Read file; confirm the `if (profile?.username) redirect('/@${profile.username}')` block is removed |
| NFR-05 | A stale / invalid session cookie does not produce an infinite redirect loop. Final destination for an authed-by-cookie but server-side-invalid session is `/sign-in` | P0 | Playwright — set a fabricated session cookie; visit `/`; assert final URL is `/sign-in` (via the middleware-level unauth gate after the server-side Convex query rejects the cookie) |
| NFR-06 | Steps 1–3 of the Team Orchestration Plan land atomically (single PR, single deploy). Reason: each step depends on the others' coordinated state — deploying the middleware change without the `getSafeRedirectUrl` default change leaves an authed `/sign-in` user still landing on `/dashboard` via the server-rendered `redirectTo` prop | P0 | PR description must reference all three commits (or steps folded into one commit). Reviewer checklist item. No CI assertion possible |
| NFR-07 | The "no-username → /onboarding" gate logic lives in exactly one helper — `apps/mirror/lib/route-guards.ts` — and is called from each layout that needs it: `app/(protected)/layout.tsx` and `app/[username]/layout.tsx`. Adding a new protected route does NOT require copying gate code — the layout just calls the helper | P0 | Structural: helper exists with a single `enforceOnboardingGate()` (or similarly-named) function; both layouts call it; `dashboard/layout.tsx` contains only the rendering shell (no Convex profile check). Reviewed via `grep -n "getCurrentProfile\|redirect\\s*(\\s*['\"]/onboarding" apps/mirror/app/\(protected\)/dashboard/layout.tsx` — returns no matches |

## Architecture

### 1. Components and structure

The "route based on auth + username state" decision must live server-side, but cannot live in the Edge middleware (which has no Convex access). We centralize it in **Next.js server components/layouts** and keep middleware doing only what it can: a cheap cookie-only gate.

**Key architectural move: `/onboarding` moves out of the `(protected)` route group.** This decouples "onboarding = the route users go TO when they have no username" from "protected = the group of routes gated on having a username." Without this move, any shared `(protected)/layout.tsx` gate would infinite-loop on `/onboarding`. With this move, a single shared layout cleanly enforces the gate for every current and future protected route.

**New files:**

| File | Purpose |
| --- | --- |
| `apps/mirror/lib/route-guards.ts` | Single-source helper. Exports `enforceOnboardingGate()` — if session cookie is present AND `getCurrentProfile()` returns `null` or lacks `username`, calls `redirect('/onboarding')`. If no session, returns silently (other gates handle unauth'd users). Called from both the shared `(protected)` layout and `[username]` layout so the rule is authored exactly once (NFR-07). |
| `apps/mirror/app/(protected)/layout.tsx` | Shared layout for the protected route group. Calls `enforceOnboardingGate()`, then renders `{children}`. Future protected routes automatically inherit the gate. |
| `packages/features/auth/utils/__tests__/validate-redirect.test.ts` | Vitest unit test for `getSafeRedirectUrl` default change. Lives in the owning package, not the consuming app, so any future consumer of the utility gets the coverage. |
| `apps/mirror/e2e/auth-routing.spec.ts` | New Playwright suite covering FR-01 through FR-08, FR-11, FR-12, NFR-02, NFR-05 |

**Files to modify:**

| File | Change |
| --- | --- |
| `apps/mirror/app/page.tsx` | Convert to `async` server component. If `profile?.username` → `redirect('/@${profile.username}')`; else call `enforceOnboardingGate()` (handles "authed no-username → /onboarding"); else render `<MirrorHomePage />` for unauth'd. Using the shared helper keeps the gate logic single-source. |
| `apps/mirror/middleware.ts` | Change the destination at line 20 from `new URL("/dashboard", request.url)` to `new URL("/", request.url)`. |
| `apps/mirror/app/(protected)/onboarding/page.tsx` | **Move** this file to `apps/mirror/app/onboarding/page.tsx` (out of the route group). Add a server-side pre-check at the top: load profile; if `profile?.username && profile.onboardingComplete` → `redirect('/@${profile.username}')`. Retain the existing `isAuthenticated()` guard. |
| `apps/mirror/app/(protected)/dashboard/layout.tsx` | Remove the `if (profile?.username) redirect('/@${profile.username}')` block and the `fetchAuthQuery(getCurrentProfile)` call entirely. The layout becomes minimal (or is deleted if only the `main` wrapper remains — can be absorbed into the shared `(protected)/layout.tsx`). The "no-username → /onboarding" gate is moved up to the new `(protected)/layout.tsx`. |
| `packages/features/auth/utils/validate-redirect.ts` | Change default-fallback string from `"/dashboard"` to `"/"` at line 52. Update the JSDoc on line 47. |
| `apps/mirror/e2e/auth.spec.ts` | Update any test that asserts authed `/sign-in` or `/sign-up` → `/dashboard`; the new destination is `/` (observable via response header) or the downstream profile/onboarding URL. |
| `apps/mirror/e2e/onboarding.authenticated.spec.ts` | Line 8: tighten `/\/(dashboard\|@test-user)/` → `/\/@test-user/`. Lines 21–23: split into two tests — "user-with-username visits `/dashboard` → renders dashboard" (FR-05) and "user-without-username visits `/dashboard` → `/onboarding`" (FR-04). |
| `apps/mirror/e2e/auth-fixture.authenticated.spec.ts` | Audit the `/\(dashboard\|@test-user\)/` alternation (≈ line 11); since the fixture user has a username, tighten to `/@test-user` only. Confirms FR-05 and aligns with NFR-03. |
| `apps/mirror/app/[username]/layout.tsx` | Call `enforceOnboardingGate()` near the top of the async layout (before the reserved-username `notFound()` check is fine — gate fires first for authed no-username users). Unauth'd visitors still pass through and see public profiles. Satisfies FR-12. |

**Files to potentially delete:**

| File | Reason |
| --- | --- |
| `apps/mirror/app/(protected)/dashboard/layout.tsx` | If, after removing the redirect block, the only remaining content is `return <main className="h-screen">{children}</main>`, this can be absorbed into the shared `(protected)/layout.tsx`. Keep only if future divergent styling is anticipated. |

**Dependencies to add:** none.

### 2. How data flows

Trace three flows end-to-end:

**Flow A — Returning user, already onboarded, hits `/`:**
1. Browser → `GET /`.
2. Middleware reads `better-auth/cookies`. Session cookie present → `isAuthenticated = true`. `/` is a public route, so middleware passes through (`NextResponse.next()`).
3. Next.js RSC renders `app/page.tsx`. New code: `fetchAuthQuery(api.users.queries.getCurrentProfile)` returns `{username: "rick-rubin", onboardingComplete: true, ...}`.
4. Server component calls `redirect('/@rick-rubin')` → Next.js emits a 307 redirect response.
5. Browser → `GET /@rick-rubin`. Middleware passes through (public route, `startsWith('/@')`). Profile page renders.

**Flow B — Brand-new signup, OTP just verified:**
1. User submits OTP on `/sign-up`. `OTPSignUpForm.handleSuccess` fires. `redirectTo` prop was resolved to `"/"` (new default from FR-10) when the page was server-rendered.
2. `window.location.href = "/"` → full-page navigation. Browser initiates fetch of `/`.
3. Middleware sees session cookie → `isAuthenticated = true`. `/` is public → passes through.
4. `app/page.tsx` server component: `getCurrentProfile` — if the Better Auth `onCreate` trigger has already run, returns `{username: undefined, onboardingComplete: false, ...}`. If not yet, returns `null` (authed-but-no-record race).
5. Either way (no username), server redirects to `/onboarding` with a 307.
6. Browser follows to `/onboarding`. Middleware passes (authed, not a public-route check that matters). `app/onboarding/page.tsx` server-side pre-check: profile has no username → does not redirect → renders wizard.
7. Wizard: if profile was `null`, the existing `ensureProfile` backfill mutation runs (lines 19–27 of `onboarding-wizard.tsx`) and the Convex query reactively populates. User picks username, completes step 2, wizard sees `onboardingComplete && username` and `router.replace('/@${username}')`.

**Flow C — Authed user types `/dashboard` manually:**
1. Middleware sees cookie → passes (not an AUTH_ROUTE).
2. `app/(protected)/layout.tsx` (new) runs. Calls `enforceOnboardingGate()`. If `!profile?.username` → `redirect('/onboarding')`. Otherwise returns; layout renders children.
3. `dashboard/page.tsx` renders the Insights text.

**Flow D — No-username authed user opens a share-link `/@rick-rubin`:**
1. Middleware sees cookie → `/@*` is public → passes.
2. `app/[username]/layout.tsx` runs. Calls `enforceOnboardingGate()` before `fetchAuthQuery(getByUsername)`. Gate sees session cookie + profile with no username → `redirect('/onboarding')`.
3. Browser follows to `/onboarding`. Wizard renders. Rick Rubin's profile was never fetched or streamed.

**Flow E — Signed-out visitor opens the same `/@rick-rubin` share-link:**
1. Middleware sees no cookie → `/@*` is public → passes.
2. `[username]/layout.tsx` runs. `enforceOnboardingGate()` sees no session cookie → returns immediately. Layout continues, fetches profile, renders Rick Rubin's page normally.

**Key boundaries:**
- Client ↔ server: middleware (Edge, cookie-only) vs server components (Node, can Convex-query).
- Trust: session cookie is the only auth signal middleware trusts. Server components trust the cookie to prove *authentication* but re-query Convex for *authorization + profile state* (username/onboardingComplete).
- Async: `ensureProfile` backfill races with the `onCreate` trigger. Both write to the same `users` row; `ensureProfile` uses `patch`-style semantics and is idempotent.

### 3. Why this works

**Invariants preserved/strengthened:**
- **Session cookie is always the auth source of truth in middleware.** No Convex call in middleware means the Edge runtime contract is preserved — documented in `.claude/rules/auth.md`. NFR-01 verifies this structurally by constraining imports.
- **Username existence is always re-validated server-side before routing.** No client-side routing logic that could be bypassed by a stale in-memory store.
- **Single source of post-auth landing logic.** `app/page.tsx` is the one place that decides "authed user → where next." Previously, this decision was split across middleware (`/dashboard`), dashboard layout (`/@username`), and `getSafeRedirectUrl` (fallback `/dashboard`). Centralizing the decision eliminates drift.
- **Single source of the onboarding gate.** `enforceOnboardingGate()` in `apps/mirror/lib/route-guards.ts` owns the "has username" check exactly once (NFR-07). Every layout that needs the gate calls the helper — `(protected)/layout.tsx`, `[username]/layout.tsx`, and `app/page.tsx`. New routes opt in by calling the helper; the policy logic never duplicates.
- **Universal "no-username → onboarding" rule.** Per user requirement, a logged-in user without a username cannot reach ANY in-app route except `/onboarding` — including public profile routes. This is enforced in both the `(protected)` layout and the `[username]` layout via the same helper.

**Classes of bugs made impossible (or much harder):**
- **"User trapped on `/dashboard` with no username."** Before: the dashboard layout only redirected *away* if a username existed, so a no-username user rendered the Insights page with no way forward. After: the shared `(protected)` layout server-redirects them to `/onboarding`.
- **"User sees sign-up form after signing up."** The middleware-level redirect catches the direct-navigation case; `/`'s server-component logic ensures the post-OTP landing is always profile or onboarding.
- **"Auto-redirect loops on `/onboarding`."** Moving `/onboarding` out of `(protected)` guarantees the shared `(protected)` gate does not redirect `/onboarding` to itself.
- **"Future protected route forgets the gate."** With NFR-07 enforced at the shared-layout level, the gate cannot be forgotten — `dashboard` inherits it, `settings` (future) inherits it, and so on.

**Existing behavior guaranteed unchanged:**
- Unauthenticated users on `/`, `/sign-in`, `/sign-up`, and all `/@*` routes see exactly the same UI they see today. Verified by FR-03 and FR-12 case (b), and by scoping the gate to "has session cookie AND no username" — unauth'd users have no cookie and exit the helper early.
- Public profile routes `/@someone-else` still render for authed users who HAVE their own username. Only no-username authed users are redirected. Share-links to profiles continue to work for the vast majority of viewers.
- `/onboarding` wizard behavior in-flight is unchanged — FR-09 is explicit that `onboarding-wizard.tsx` is NOT modified. Only a page-level server gate is added for users hitting the route directly while already onboarded.

**Why this approach over alternatives:**
- **vs. "do it all in middleware"**: Middleware can't call Convex. Would require duplicating profile state into the session cookie (complex, cache-coherency bugs).
- **vs. "keep `/onboarding` in `(protected)` and special-case the exemption in a shared layout"**: Requires reading non-stable Next.js pathname headers to exempt `/onboarding` from the gate. Fragile — the header is not a stable contract.
- **vs. "per-page gate copy/paste"**: Original draft approach. Leaks maintenance burden to every future protected route. Rejected.
- **vs. "make `/onboarding` the post-auth landing directly"**: Couples the onboarding UI with the routing decision. We prefer `/` to BE the decision point because it's the URL users naturally land on from bookmarks, shares, and the URL bar.

### 4. Edge cases and gotchas

- **Stale session cookie.** If a browser holds a session cookie that's server-side invalid, middleware sees "authenticated" but `getCurrentProfile` returns `null`. Home page (`app/page.tsx`) redirects to `/onboarding`. `/onboarding`'s own `isAuthenticated()` check re-validates against the Convex/Better Auth server and fails, redirecting to `/sign-in`. Net: two redirect hops, then `/sign-in`. No loop because `/sign-in` is public and middleware allows unauth'd access. NFR-05 tests this.
- **Race: OTP verify → redirect to `/` → `onCreate` trigger hasn't fired yet.** `getCurrentProfile` returns `null`. Home redirects to `/onboarding`. Onboarding wizard's `ensureProfile` mutation backfills. Pre-existing behavior — must not regress: FR-08's server-side redirect on `/onboarding` ONLY fires if `profile?.username && profile.onboardingComplete`, not if profile is `null`. Spec phrasing preserves this.
- **`getSafeRedirectUrl(undefined, undefined)` corner.** At `packages/features/auth/components/shared/oauth-buttons.tsx:42`, the code is `redirectTo ? getSafeRedirectUrl(redirectTo, undefined) : undefined`. If `redirectTo` is undefined, `callbackURL` becomes undefined, and Better Auth uses its own default. After FR-10, `sign-in/page.tsx` always passes `redirectTo="/"` (never undefined), so `callbackURL` is always `"/"` and Better Auth's default never fires. Audit in Step 6: confirm `packages/convex/convex/auth/client.ts` has no conflicting server-side `defaultRedirectUrl` or callback default pointing at `/dashboard`. Grep confirmed this file is clean today.
- **`?next=/dashboard` explicit override.** A user who bookmarked `/sign-in?next=/dashboard` will still land on `/dashboard` after auth (`isValidRedirectUrl` allows relative paths). This is intentional — explicit `next=` is a user-provided override, and `/dashboard` is a legitimate route. The user's rule 3 is about *default* auto-routing, not blocking `/dashboard` as a valid destination when the user explicitly asked for it.
- **Playwright authenticated fixture currently targets `test-user`.** Existing tests use `apps/mirror/e2e/fixtures/auth.ts`, which seeds a user *with* a username. New no-username test cases need either an extended fixture or a Convex test mutation that can unset `username` on the seeded user between tests. Step 5's scope includes this fixture extension.
- **Middleware's `AUTH_ROUTES` redirect destination change — two-hop latency.** An authed user hitting `/sign-in` triggers `/sign-in` → 307 `/` → 307 `/@username`. Two redirects. Imperceptible in practice; much simpler than trying to do the full routing in middleware.
- **OAuth (Google) signup.** `packages/features/auth/components/shared/oauth-buttons.tsx` passes an explicit `callbackURL`. After FR-10 that value is `/`, so the post-OAuth landing goes through `app/page.tsx` and routes correctly. No Playwright e2e coverage for the Google OAuth flow (requires real Google credentials) — flagged in Open Questions.
- **Client-side wizard redirect still fires.** `onboarding-wizard.tsx:31` does `router.replace('/@${username}')`. This remains — it handles the "user just finished step 2" transition within an existing wizard session. FR-08's server-side redirect covers the orthogonal case of a returning-user direct navigation to `/onboarding`. Both layers are needed; they don't conflict.
- **`isValidRedirectUrl("/")` validity.** `"/"` is a single-character relative path starting with `/` and not `//`, so `isValidRedirectUrl` returns true. New default is valid per the existing util; no util changes required beyond the fallback string.
- **Stray `/dashboard` references.** Grep across `apps/mirror/` finds `/dashboard` only in: `middleware.ts` (will change), `e2e/*.spec.ts` (will change), `AGENTS.md` (documentation — update separately). No `<Link href="/dashboard">` in the UI, so no UI element auto-navigates to `/dashboard`.
- **Share-link UX trade-off.** With FR-12's strict gate, a no-username authed user who clicks a friend's Mirror share-link lands on `/onboarding` instead of the friend's profile. This is the user's stated intent ("first time users should ALWAYS see /onboarding") and prioritizes onboarding completion over casual browsing. Mitigation: after finishing onboarding, the original share-link is NOT preserved — the user lands on their own `/@<username>` page. A future enhancement could preserve the intended destination via the `?next=` mechanism, but is out of scope here. Documented explicitly so a future PR doesn't quietly "fix" this as a regression.

## Unit Tests

| Test File | Test Case | Verifies |
| --- | --- | --- |
| `packages/features/auth/utils/__tests__/validate-redirect.test.ts` | `getSafeRedirectUrl(undefined)` returns `"/"` | FR-10 |
| `packages/features/auth/utils/__tests__/validate-redirect.test.ts` | `getSafeRedirectUrl(null)` returns `"/"` | FR-10 |
| `packages/features/auth/utils/__tests__/validate-redirect.test.ts` | `getSafeRedirectUrl("")` returns `"/"` | FR-10 |
| `packages/features/auth/utils/__tests__/validate-redirect.test.ts` | `getSafeRedirectUrl("/explicit-next")` returns `"/explicit-next"` (user-provided override preserved) | FR-10 |
| `packages/features/auth/utils/__tests__/validate-redirect.test.ts` | `getSafeRedirectUrl("https://evil.com/pwn")` returns `"/"` (unsafe absolute falls back to new default) | FR-10 |

Co-located with the source per package convention. If `packages/features/` does not already have a Vitest config, add one (mirrors `packages/convex/`'s pattern). If adding a new test runner is out of scope, fall back to `apps/mirror/tests/unit/validate-redirect.test.ts` — but this leaves other consumers uncovered.

## Playwright E2E Tests

| Test File | Scenario | Verifies |
| --- | --- | --- |
| `apps/mirror/e2e/auth-routing.spec.ts` | Unauthed visitor on `/` sees "Sign in" + "Create account" buttons | FR-03 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Authed user with username visits `/` → final URL is `/@test-user`; home markup never visible | FR-02, NFR-02 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Authed user without username visits `/` → final URL is `/onboarding`; home markup never visible | FR-01, NFR-02 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Authed user with username visits `/sign-in` → final URL is `/@test-user`; sign-in form never visible | FR-06, NFR-02 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Authed user without username visits `/sign-up` → final URL is `/onboarding`; sign-up form never visible | FR-06, NFR-02 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Authed user with username visits `/dashboard` → URL stays `/dashboard`; page shows "Insights" | FR-05 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Authed user without username visits `/dashboard` → final URL is `/onboarding` | FR-04 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Authed user with `onboardingComplete=true` visits `/onboarding` → final URL is `/@test-user`; wizard never visible | FR-08 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Middleware redirects authed `/sign-in` to `/` at the HTTP 302 layer (capture first response with `page.on('response')`, assert `location: /`) | FR-11 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Full OTP signup flow from `/sign-up` — via `page.on('framenavigated')` capture URL trail; assert it includes `/` and `/onboarding` and does NOT include `/dashboard` | FR-07 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Fabricated/invalid session cookie → visit `/` → final URL is `/sign-in` (no infinite loop) | NFR-05 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Authed no-username session visits `/@rick-rubin` → final URL is `/onboarding`; Rick Rubin's profile markup never visible | FR-12 |
| `apps/mirror/e2e/auth-routing.spec.ts` | Unauthenticated visitor loads `/@rick-rubin` → Rick Rubin's profile renders; no redirect | FR-12 |
| `apps/mirror/e2e/auth.spec.ts` (modified) | Regression: unauth'd protected-route access still redirects to `/sign-in` | (regression) |
| `apps/mirror/e2e/onboarding.authenticated.spec.ts` (modified) | Wizard completion ends on `/@test-user` without any `/dashboard` URL in the nav trail | FR-09, NFR-03 |
| `apps/mirror/e2e/auth-fixture.authenticated.spec.ts` (modified) | Tighten URL regex to `/@test-user` only; drop the `dashboard` alternative | FR-05, NFR-03 |

Tests use `@playwright/test` CLI only (`.claude/rules/testing.md`). The fixture in `apps/mirror/e2e/fixtures/auth.ts` needs an extension that yields a no-username authenticated session — implementation is an orchestration detail, not a spec concern.

## Team Orchestration Plan

**Atomicity note (NFR-06):** Steps 1, 2, and 3 MUST land as a single PR (or a single deployment). Landing Step 3 (middleware change) without Step 1 (fallback default) leaves `/sign-in` server-rendering `redirectTo="/dashboard"` from the old default, which is exactly the bug Step 1 fixes.

```
Step 1 — Update the shared auth utility (default fallback)
Suggested executor: general-purpose
Scope:
  - packages/features/auth/utils/validate-redirect.ts (change fallback string + JSDoc)
  - packages/features/auth/utils/__tests__/validate-redirect.test.ts (new Vitest file — FR-10)
  - Vitest config in packages/features/ if not present
Hard gate:
  pnpm --filter=@feel-good/features test
  pnpm build --filter=@feel-good/features
Verifies: FR-10

Step 2 — Wire the home-page server-side routing decision
Suggested executor: general-purpose
Scope:
  - apps/mirror/app/page.tsx (convert to async server component; auth + profile read; redirect)
Hard gate:
  pnpm build --filter=@feel-good/mirror
  pnpm lint --filter=@feel-good/mirror
Verifies: FR-01, FR-02, FR-03

Step 3 — Restructure protected route group + update middleware + onboarding move + public profile gate
Suggested executor: general-purpose
Scope:
  - NEW apps/mirror/lib/route-guards.ts (single-source `enforceOnboardingGate()` helper)
  - apps/mirror/middleware.ts (change AUTH_ROUTES destination from /dashboard to /)
  - NEW apps/mirror/app/(protected)/layout.tsx (calls enforceOnboardingGate)
  - apps/mirror/app/(protected)/dashboard/layout.tsx (remove /@username redirect; remove profile fetch; may be deleted if only wrapper remains)
  - MOVE apps/mirror/app/(protected)/onboarding/page.tsx → apps/mirror/app/onboarding/page.tsx (out of the route group)
  - Add server-side pre-check to the moved onboarding page.tsx (FR-08)
  - apps/mirror/app/[username]/layout.tsx (call enforceOnboardingGate early in the async body; satisfies FR-12)
Hard gate:
  pnpm build --filter=@feel-good/mirror
  pnpm lint --filter=@feel-good/mirror
  pnpm --filter=@feel-good/features test   # re-run FR-10 to confirm atomicity
Verifies: FR-04, FR-05, FR-06, FR-08, FR-11, FR-12, NFR-01, NFR-04, NFR-07

Step 4 — Update existing e2e tests that assume old behavior
Suggested executor: general-purpose
Scope:
  - apps/mirror/e2e/auth.spec.ts (update /dashboard assertions for authed auth-route redirects)
  - apps/mirror/e2e/onboarding.authenticated.spec.ts (tighten line 8; split no-username vs with-username dashboard cases)
  - apps/mirror/e2e/auth-fixture.authenticated.spec.ts (tighten URL regex; drop /dashboard arm)
Hard gate:
  pnpm --filter=@feel-good/mirror test:e2e -g "Middleware|Onboarding|auth-fixture"
Verifies: NFR-03

Step 5 — Add the new auth-routing e2e suite
Suggested executor: general-purpose
Scope:
  - apps/mirror/e2e/auth-routing.spec.ts (new file covering FR-01 through FR-08, FR-11, FR-12, NFR-02, NFR-05)
  - apps/mirror/e2e/fixtures/auth.ts (extend with no-username fixture variant)
Hard gate:
  pnpm --filter=@feel-good/mirror test:e2e -g "auth-routing"
Verifies: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-11, FR-12, NFR-02, NFR-05

Step 6 — Full regression sweep + invariant audits
Suggested executor: general-purpose
Scope: no code changes; verification only
Hard gate:
  pnpm --filter=@feel-good/mirror lint
  pnpm --filter=@feel-good/mirror build
  pnpm --filter=@feel-good/features test
  pnpm --filter=@feel-good/mirror test:e2e
  # Structural invariants:
  grep -E '^import' apps/mirror/middleware.ts | wc -l   # expect: 2
  grep -n "getCurrentProfile\|redirect" apps/mirror/app/\(protected\)/dashboard/layout.tsx   # expect: no matches (or only the auth-only redirect)
  grep -rn "/dashboard" apps/mirror/app/ packages/features/   # every hit must be justified
  grep -rn "defaultRedirectUrl\|callbackURL" packages/convex/convex/auth/   # expect: no server-side default pointing at /dashboard
Verifies: NFR-01, NFR-03, NFR-04, NFR-07 + full FR regression
```

Reviewer pairing is decided downstream by `.claude/skills/orchestrate-implementation/SKILL.md` at wave-execution time. Expected routed reviewers per the monorepo's critique table (informational, not prescriptive): `code-review-correctness`, `code-review-convention`, `code-review-security` (auth/middleware surface), `code-review-tests`, `code-review-data-integrity` (if the protected-layout change is read as a schema-adjacent contract).

## Open Questions

_All Open Questions resolved by user on 2026-04-20. Decisions captured below for implementer reference._

1. **Public profile routes for no-username users — RESOLVED: strict gate.** A logged-in user without a username who visits `/@someone-else` is redirected to `/onboarding`. Codified as FR-12 and enforced in `[username]/layout.tsx` via the shared `enforceOnboardingGate()` helper. Unauth'd visitors still browse public profiles normally.

2. **`?next=/dashboard` explicit override — RESOLVED: honored.** An explicit `?next=/dashboard` after sign-in/sign-up lands the user on `/dashboard`. The "rule 3" constraint is about default auto-routing, not blocking `/dashboard` as a valid explicit destination. No further gate needed.

3. **Google OAuth e2e coverage — RESOLVED: accept gap.** No Playwright coverage for the Google OAuth flow. The compensating control is the Step 6 grep audit over `packages/convex/convex/auth/` confirming no server-side `/dashboard` default, plus the explicit `callbackURL="/"` from `getSafeRedirectUrl("/")` flowing from FR-10.

4. **Dashboard layout file — keep or delete?** After removing the redirect and profile-fetch code, the only remaining content may be `return <main className="h-screen">{children}</main>`. **Implementer's choice** — if the shared `(protected)/layout.tsx` provides the `<main>` wrapper, delete. Otherwise, keep as a minimal shell.

## Adversarial Review Summary

Phase 4 iteration: 1. Stop reason: quality bar met — zero Critical, zero Important concerns remain unresolved. Post-verification amendment (2026-04-20) added FR-12 per user decision on Open Question 1.

| Concern | Severity | Resolution |
| --- | --- | --- |
| C-1: Steps 1–3 must land atomically; middleware change without fallback change leaves `/sign-in` rendering old `/dashboard` destination | Critical | **Accepted** — added NFR-06 and an atomicity note at the top of the Team Orchestration Plan; Step 3 hard gate now re-runs Step 1's unit test to confirm |
| C-2: Flow B's post-OTP flash is not tested; FR-07 only asserts final URL, not absence of `/dashboard` hop | Critical | **Accepted** — FR-07 verification updated to require `page.on('framenavigated')` URL-trail capture asserting no `/dashboard` in the path |
| I-1: Gate-per-route design is a structural trap — future protected routes can forget the gate | Important | **Accepted** — restructured architecture: `/onboarding` moves out of `(protected)` group, a shared `(protected)/layout.tsx` now owns the gate exactly once (NFR-07) |
| I-2: NFR-01 grep was checking identifiers, not imports; could pass while middleware silently gained HTTP calls | Important | **Accepted** — NFR-01 verification rewritten to constrain imports structurally: `grep -E '^import' ... \| wc -l` returns exactly 2 |
| I-3: `auth-fixture.authenticated.spec.ts` needs update too; was missing from the modify list | Important | **Accepted** — file added to Step 4 scope and to the modify-files table |
| I-4: OAuth path may bypass FR-07 if Better Auth's server-side `defaultRedirectUrl` is `/dashboard` | Important | **Partially accepted** — grep of `packages/convex/convex/auth/` confirmed no conflicting server-side default today; explicit `callbackURL="/"` after FR-10 closes the client-side gap. Added Step 6 grep audit to defend against future regression. OAuth e2e coverage gap acknowledged in Open Questions |
| M-1: Unit test in `apps/mirror/tests/unit/` leaves other package consumers uncovered | Minor | **Accepted** — test moves to `packages/features/auth/utils/__tests__/validate-redirect.test.ts` |
| M-2: Stale-cookie edge case is documented but not tested | Minor | **Accepted** — added NFR-05 plus a Playwright test case for the fabricated-cookie scenario |
