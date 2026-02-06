---
title: "feat: Complete Auth Implementation (OTP + Google OAuth + E2E)"
type: feat
date: 2026-02-06
---

# feat: Complete Auth Implementation (OTP + Google OAuth + E2E)

## Overview

Complete the authentication system by adding email OTP as the primary passwordless method in Mirror, verifying Google OAuth end-to-end, and keeping magic link available in the shared package for future use. The goal is a production-ready auth flow where users can authenticate via OTP or Google, with full E2E test coverage.

## Problem Statement / Motivation

The current auth implementation has magic link as the only email-based auth method in Mirror. The product decision is to switch to OTP (better UX -- users stay in the same browser tab) while keeping magic link in the shared package. Google OAuth exists in the UI but needs end-to-end verification. No E2E tests exist for any auth flow.

## Current State

| Component | Status | Location |
|-----------|--------|----------|
| Magic link (server plugin) | Implemented | `packages/convex/convex/auth.ts` |
| Magic link (client plugin) | Implemented | `packages/features/auth/client.ts` |
| Magic link (hook) | Implemented | `packages/features/auth/hooks/use-magic-link-request.ts` |
| Magic link (views/forms/blocks) | Implemented | `packages/features/auth/` |
| Google OAuth (server config) | Implemented | `packages/convex/convex/auth.ts` socialProviders |
| Google OAuth (UI button) | Implemented | `packages/features/auth/components/shared/oauth-buttons.tsx` |
| Email OTP (server plugin) | **Missing** | -- |
| Email OTP (client plugin) | **Missing** | -- |
| Email OTP (hook) | **Missing** | -- |
| Email OTP (views/forms) | **Missing** | -- |
| OTP email template | **Missing** | -- |
| `InputOTP` UI primitive | Exists | `packages/ui/src/primitives/input-otp.tsx` |
| `?next` param plumbing | **Broken** | `apps/mirror/app/(auth)/sign-in/page.tsx` hardcodes `/dashboard` |
| E2E tests | **Missing** | -- |

## Proposed Solution

### Architecture

Follow the existing four-layer pattern (blocks -> forms -> views -> hooks) to add OTP auth:

```
packages/features/auth/
├── hooks/
│   ├── use-magic-link-request.ts     # Keep (existing)
│   └── use-email-otp-sign-in.ts      # NEW
├── views/
│   ├── magic-link-view.tsx           # Keep (existing)
│   ├── email-otp-view.tsx            # NEW (shared two-phase view)
│   ├── email-otp-login-view.tsx      # NEW
│   └── email-otp-sign-up-view.tsx    # NEW
├── components/forms/
│   ├── magic-link-login-form.tsx     # Keep (existing)
│   ├── magic-link-sign-up-form.tsx   # Keep (existing)
│   ├── email-otp-login-form.tsx      # NEW
│   └── email-otp-sign-up-form.tsx    # NEW
├── blocks/
│   ├── login-block.tsx               # MODIFY (swap magic link -> OTP)
│   └── sign-up-block.tsx             # MODIFY (swap magic link -> OTP)
└── client.ts                         # MODIFY (add emailOTPClient plugin)
```

### OTP Flow State Machine

```
[email-entry] --submit--> [loading-send] --success--> [otp-entry] --submit--> [loading-verify] --success--> [redirect]
      ^                        |                            |                        |
      |                        v                            v                        v
      +----[error-send]--------+       [resend] ---> [loading-send]    [error-verify]--->[otp-entry]
      |                                     |
      +---[back/change-email]---------------+
```

The hook manages an internal `phase: "email" | "otp"` state. `AuthStatus` is NOT modified -- the hook uses the existing `idle/loading/success/error` for each phase independently.

### Key Design Decisions

1. **Internal phase state, not extended AuthStatus** -- Keeps the shared type stable. The hook exposes `phase` as a read-only value for the view to conditionally render.
2. **`type: "sign-in"` for both sign-in and sign-up** -- Better Auth's `signIn.emailOtp()` auto-creates accounts. Sign-up and sign-in are functionally identical at the API level (no `name` field in current forms, matching existing magic link pattern).
3. **Auto-submit on OTP completion** -- When all 6 digits entered, auto-verify. Manual "Verify" button available as fallback.
4. **3-3 OTP layout** -- `InputOTPGroup` + `InputOTPSeparator` + `InputOTPGroup` for readability.
5. **`disableSignUp: false`** -- New email addresses auto-create accounts on OTP verify.
6. **Keep all magic link exports** -- Only `LoginBlock`/`SignUpBlock` change their internal rendering.

---

## Technical Approach

### Phase 1: Backend (Convex)

#### 1.1 Add `emailOTP` plugin to Better Auth server config

**File:** `packages/convex/convex/auth.ts`

```typescript
import { emailOTP } from "better-auth/plugins";

// Inside createAuth, add to plugins array:
emailOTP({
  async sendVerificationOTP({ email, otp, type }) {
    void ctx.runAction(api.email.sendOTPVerification, {
      to: email,
      code: otp,
    });
  },
  otpLength: 6,
  expiresIn: 300, // 5 minutes
}),
```

Add rate limit rule:

```typescript
customRules: {
  "/sign-in/magic-link": { window: 60, max: 3 },
  "/email-otp/send-verification-otp": { window: 60, max: 3 },
},
```

#### 1.2 Add OTP email action

**File:** `packages/convex/convex/email.ts`

New `sendOTPVerification` action that renders the OTP code prominently in the email body (NOT as a clickable link). Uses the same Resend/email template pattern as `sendMagicLink`.

#### 1.3 Verify polyfills

**File:** `packages/convex/convex/http.ts`

Check if `MessageChannel` polyfill is needed (per reference example). Add `import "./polyfills"` if missing.

---

### Phase 2: Shared Client

#### 2.1 Add `emailOTPClient` plugin

**File:** `packages/features/auth/client.ts`

```typescript
import { emailOTPClient } from "better-auth/client/plugins";

function createFullAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [convexClient(), magicLinkClient(), emailOTPClient()],
  });
}
```

#### 2.2 Update types

**File:** `packages/features/auth/types.ts`

- Add `"email-otp"` to `AuthProvider` union type
- Add OTP error codes to `AUTH_ERROR_MESSAGES`:
  - `OTP_EXPIRED` -> "Your code has expired. Please request a new one."
  - `INVALID_OTP` -> "Invalid code. Please try again."
  - `OTP_NOT_FOUND` -> "Invalid code. Please request a new one."

#### 2.3 Add OTP schema

**File:** `packages/features/auth/lib/schemas/auth.schema.ts`

```typescript
export const OTPSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6, "Enter all 6 digits"),
});
```

---

### Phase 3: Hook Layer

#### 3.1 Create `useEmailOTPSignIn` hook

**File:** `packages/features/auth/hooks/use-email-otp-sign-in.ts`

```typescript
interface UseEmailOTPSignInReturn {
  // State
  email: string;
  setEmail: (email: string) => void;
  otp: string;
  setOtp: (otp: string) => void;
  phase: "email" | "otp";
  status: AuthStatus;
  error: string | null;

  // Actions
  sendOTP: () => Promise<void>;
  verifyOTP: () => Promise<void>;
  resendOTP: () => Promise<void>;
  reset: () => void;           // Reset to email phase
  goBackToEmail: () => void;   // Back to email entry
}
```

Pattern follows `useMagicLinkRequest`:
- Destructure options at hook level
- Use `statusRef` for double-submission guard
- Validate redirect URLs via `getSafeRedirectUrl`

---

### Phase 4: View Layer

#### 4.1 Create `EmailOTPView` (shared base)

**File:** `packages/features/auth/views/email-otp-view.tsx`

Two-phase view:
- **Phase "email"**: Card with email input + "Send code" button (same style as `MagicLinkView`)
- **Phase "otp"**: Card showing entered email (read-only), `InputOTP` component (3-3 layout), "Verify" button, "Resend code" link, "Use different email" link

Both phases use the same Card/CardHeader/CardContent structure.

#### 4.2 Create variant wrappers

- `email-otp-login-view.tsx` -- Login-specific copy ("Sign in to your account")
- `email-otp-sign-up-view.tsx` -- Sign-up copy ("Create your account")

Both are thin wrappers around `EmailOTPView` with different titles/descriptions, matching the magic link pattern.

---

### Phase 5: Form Layer

#### 5.1 Create form containers

- `email-otp-login-form.tsx` -- Wires `useEmailOTPSignIn` to `EmailOTPLoginView`
- `email-otp-sign-up-form.tsx` -- Wires `useEmailOTPSignIn` to `EmailOTPSignUpView`

Same container pattern as `MagicLinkLoginForm`/`MagicLinkSignUpForm`.

---

### Phase 6: Block Layer (Mirror Integration)

#### 6.1 Update `LoginBlock`

**File:** `packages/features/auth/blocks/login-block.tsx`

Replace `MagicLinkLoginForm` with `EmailOTPLoginForm`. Keep `AuthDivider` + `OAuthButtons`.

```
[EmailOTPLoginForm]
[AuthDivider "or"]
[OAuthButtons (Google)]
[Sign up link]
```

#### 6.2 Update `SignUpBlock`

Same swap: `MagicLinkSignUpForm` -> `EmailOTPSignUpForm`.

---

### Phase 7: Mirror App Fixes

#### 7.1 Fix `?next` parameter plumbing

**Files:**
- `apps/mirror/app/(auth)/sign-in/page.tsx`
- `apps/mirror/app/(auth)/sign-up/page.tsx`

Read `searchParams.next`, pass through `getSafeRedirectUrl()`, forward as `redirectTo` prop to the block.

```typescript
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = getSafeRedirectUrl(next);
  return <LoginBlock authClient={authClient} redirectTo={redirectTo} />;
}
```

---

### Phase 8: Barrel Exports

Update all index.ts files to export new components while preserving magic link exports:

- `packages/features/auth/hooks/index.ts` -- add `useEmailOTPSignIn`
- `packages/features/auth/views/index.ts` -- add OTP views
- `packages/features/auth/components/forms/index.ts` -- add OTP forms
- `packages/features/package.json` -- verify exports paths cover new files

---

### Phase 9: E2E Testing

#### 9.1 Test Infrastructure

Choose one of:
- **Playwright** with Convex dev server
- Intercept OTP from Convex action logs (dev mode) or mock the `sendOTPVerification` action

For Google OAuth in E2E: mock the OAuth flow or test manually (Google requires real interaction).

#### 9.2 Test List

**Tier 1: Critical Path (must pass before merge)**

- [ ] **OTP sign-in happy path**: Enter email -> receive OTP -> enter code -> session created -> redirected to dashboard
- [ ] **OTP sign-up happy path**: New email -> OTP -> account created + session -> dashboard
- [ ] **Google OAuth happy path**: Click Google -> consent -> session -> dashboard
- [ ] **Protected route redirect**: Visit /dashboard unauthenticated -> redirect to /sign-in?next=/dashboard -> authenticate -> arrive at /dashboard
- [ ] **Session cookie set/read**: After auth, session cookie present. Page refresh maintains auth state.
- [ ] **Sign out**: Click sign out -> session cleared -> redirected to sign-in

**Tier 2: Error & Edge Cases**

- [ ] **OTP expired**: Wait > 5 minutes -> enter code -> error "Your code has expired"
- [ ] **OTP wrong code**: Enter incorrect code -> error "Invalid code"
- [ ] **OTP resend**: Click resend -> new code sent -> old code invalid
- [ ] **Rate limiting**: Send > 3 OTPs in 60s -> rate limit error
- [ ] **Redirect sanitization**: `/sign-in?next=https://evil.com` -> redirect to `/dashboard` (not evil.com)
- [ ] **Authenticated user visits /sign-in**: Redirect to /dashboard
- [ ] **Account linking**: OTP user -> Google sign-in with same email -> accounts linked

**Tier 3: Security**

- [ ] **OTP brute force protection**: Multiple wrong codes -> blocked
- [ ] **CSRF protection**: Verify Better Auth includes CSRF tokens
- [ ] **Session expiry**: After 14 days, session invalid
- [ ] **Cookie attributes**: HttpOnly, Secure, SameSite=Lax

---

## Acceptance Criteria

### Functional Requirements

- [ ] User can sign in via email OTP (6-digit code)
- [ ] User can sign up via email OTP (auto-creates account)
- [ ] User can sign in via Google OAuth
- [ ] Google OAuth links to existing OTP account with same email
- [ ] Magic link components remain exported and functional in the package
- [ ] Mirror app uses OTP + Google (not magic link) in its UI
- [ ] `?next` parameter correctly redirects after auth
- [ ] Sign out clears session and redirects

### Non-Functional Requirements

- [ ] OTP code expires after 5 minutes
- [ ] Rate limiting: max 3 OTP sends per 60 seconds
- [ ] Redirect URLs validated against allowed origins
- [ ] No user enumeration (generic error messages for unknown emails)
- [ ] `pnpm build` passes for all apps
- [ ] `pnpm lint` passes for all packages

### Quality Gates

- [ ] All Tier 1 tests pass
- [ ] Tier 2 tests pass for error handling
- [ ] No TypeScript errors in consuming apps
- [ ] Existing magic link imports compile without errors

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/features/auth/hooks/use-email-otp-sign-in.ts` | OTP hook with two-phase state machine |
| `packages/features/auth/views/email-otp-view.tsx` | Shared OTP view (email entry + OTP entry phases) |
| `packages/features/auth/views/email-otp-login-view.tsx` | Login variant wrapper |
| `packages/features/auth/views/email-otp-sign-up-view.tsx` | Sign-up variant wrapper |
| `packages/features/auth/components/forms/email-otp-login-form.tsx` | Login form container |
| `packages/features/auth/components/forms/email-otp-sign-up-form.tsx` | Sign-up form container |

## Files to Modify

| File | Change |
|------|--------|
| `packages/convex/convex/auth.ts` | Add `emailOTP` plugin + rate limit rule |
| `packages/convex/convex/email.ts` | Add `sendOTPVerification` action |
| `packages/features/auth/client.ts` | Add `emailOTPClient()` to plugins |
| `packages/features/auth/types.ts` | Add `"email-otp"` to AuthProvider, OTP error codes |
| `packages/features/auth/lib/schemas/auth.schema.ts` | Add `OTPSchema` |
| `packages/features/auth/hooks/index.ts` | Export `useEmailOTPSignIn` |
| `packages/features/auth/views/index.ts` | Export OTP views |
| `packages/features/auth/components/forms/index.ts` | Export OTP forms |
| `packages/features/auth/blocks/login-block.tsx` | Swap magic link -> OTP form |
| `packages/features/auth/blocks/sign-up-block.tsx` | Swap magic link -> OTP form |
| `apps/mirror/app/(auth)/sign-in/page.tsx` | Read `searchParams.next` for `redirectTo` |
| `apps/mirror/app/(auth)/sign-up/page.tsx` | Read `searchParams.next` for `redirectTo` |

---

## Dependencies & Prerequisites

1. **Google OAuth credentials** must be configured in Convex env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
2. **Resend API key** must be set in Convex env vars for OTP email delivery
3. **`SITE_URL`** in Convex env must match the app's URL for callback redirects
4. **Google OAuth redirect URI** must be configured in Google Cloud Console: `{CONVEX_SITE_URL}/api/auth/callback/google`

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Better Auth OTP error codes differ from expected | Medium | High | Test actual error codes in dev, update error map accordingly |
| OTP email delivery failures (Resend) | Low | High | Fire-and-forget is acceptable for MVP; add Convex action error logging |
| Google OAuth redirect mismatch | Medium | Medium | Document exact redirect URI configuration steps |
| `input-otp` library incompatibility | Low | Medium | Already in workspace catalog at v1.4.2; primitive component exists |
| Breaking magic link imports | Low | High | Keep all exports; only blocks change internally |

---

## Agent Orchestration Plan

### Team Structure

| Agent | Type | Responsibility |
|-------|------|----------------|
| **lead** | general-purpose | Orchestration, task assignment, integration testing |
| **backend** | general-purpose | Phase 1 (Convex: emailOTP plugin, email action, polyfills) |
| **shared-pkg** | general-purpose | Phases 2-5 (client plugin, types, hook, views, forms) |
| **integration** | general-purpose | Phases 6-8 (blocks update, Mirror fixes, barrel exports, build verification) |

### Execution Order

```
[backend]  ──Phase 1──>  ✓
                          \
[shared-pkg] ──Phase 2──> Phase 3 ──> Phase 4 ──> Phase 5 ──> ✓
                                                                \
[integration] ────────────────────────────────────────────────> Phase 6 ──> Phase 7 ──> Phase 8 ──> Build ──> ✓
```

**Dependencies:**
- `shared-pkg` can start Phase 2 (client plugin) immediately (no backend dependency)
- `shared-pkg` Phase 3 (hook) depends on Phase 2 completing (needs `AuthClient` type with OTP methods)
- `integration` Phase 6 (blocks) depends on `shared-pkg` Phase 5 completing (needs form components)
- `integration` Phase 8 (build) depends on `backend` Phase 1 completing (Convex must have OTP plugin)

**Parallel work:**
- `backend` Phase 1 and `shared-pkg` Phases 2-5 run in parallel
- `integration` starts after both complete

### Success Verification

After all agents complete:
1. `pnpm build` passes (all 3 apps)
2. `pnpm lint` passes
3. Mirror dev server starts and shows OTP + Google auth UI
4. Manual smoke test of OTP flow
5. Manual smoke test of Google OAuth flow

---

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-03-auth-package-architecture-brainstorm.md`
- Previous plan: `docs/plans/2026-02-03-auth-package-architecture-plan.md`
- Provider separation pattern: `docs/solutions/architecture-patterns/provider-separation-of-concerns.md`
- Auth server config: `packages/convex/convex/auth.ts`
- Auth client: `packages/features/auth/client.ts`
- Magic link hook (pattern to follow): `packages/features/auth/hooks/use-magic-link-request.ts`
- InputOTP primitive: `packages/ui/src/primitives/input-otp.tsx`

### External References

- Better Auth + Convex Next.js guide: https://labs.convex.dev/better-auth/framework-guides/next
- Better Auth Convex integration: https://www.better-auth.com/docs/integrations/convex
- Better Auth email OTP plugin: https://www.better-auth.com/docs/plugins/email-otp
- Better Auth magic link plugin: https://www.better-auth.com/docs/plugins/magic-link
- Better Auth social sign-in: https://www.better-auth.com/docs/authentication/social-sign-in
- Reference example repo: https://github.com/get-convex/better-auth/tree/main/examples/next
