# Auth Verification Plan for @feel-good/mirror

**Date:** 2026-01-28
**Branch:** `mirror/012726-feat-auth`
**Objective:** Verify that all three auth methods (email/password, Google OAuth, magic link) and supporting infrastructure work correctly.

## Test Configuration

- **App URL:** http://localhost:3000
- **Test Email:** hpark0011@gmail.com
- **Verification Method:** Browser automation or manual testing

---

## Verification Scope

Based on PR #66 and the implementation plan, the following needs verification:

### Auth Methods
1. **Email & Password** - Sign up, sign in, email verification
2. **Google OAuth** - OAuth flow, account linking
3. **Magic Link** - Email delivery, token validation

### Supporting Infrastructure
4. **Middleware** - Route protection, redirects
5. **Session Management** - Persistence, sign out
6. **Password Reset** - Forgot password, reset flow

---

## Pre-Verification Checklist

Before testing, ensure:

- [ ] Convex dev server is running (`pnpm dev` in `packages/convex`)
- [ ] Mirror app is running (`pnpm dev --filter=@feel-good/mirror`)
- [ ] Environment variables are configured:
  - `NEXT_PUBLIC_CONVEX_URL`
  - `NEXT_PUBLIC_CONVEX_SITE_URL`
  - `NEXT_PUBLIC_SITE_URL`
- [ ] Convex environment variables are set:
  - `BETTER_AUTH_SECRET`
  - `SITE_URL`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `RESEND_API_KEY`

---

## Verification Tests

### 1. Email & Password Authentication

#### 1.1 Sign Up Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/sign-up` | Sign up form displayed |
| 2 | Enter name, email, password (8+ chars) | Form accepts input |
| 3 | Submit form | Success message: "Check your email to verify" |
| 4 | Check email inbox | Verification email received from `auth@mirror.app` |
| 5 | Click verification link | Email verified, redirected to dashboard |

#### 1.2 Sign In Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/sign-in` | Sign in form displayed |
| 2 | Enter valid credentials | Form accepts input |
| 3 | Submit form | Redirected to `/dashboard` |
| 4 | Check dashboard | User email displayed, sign out button visible |

#### 1.3 Error Handling
| Test | Input | Expected Error |
|------|-------|----------------|
| Invalid password | Wrong password | "Invalid email or password" |
| Unverified email | Valid but unverified | "Please verify your email" |
| Non-existent user | Unknown email | "Invalid email or password" |
| Short password | <8 chars on signup | "Password too short" |
| Duplicate email | Existing email on signup | "Email already exists" |

---

### 2. Google OAuth Authentication

#### 2.1 OAuth Sign In
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/sign-in` | OAuth buttons visible |
| 2 | Click "Continue with Google" | Redirected to Google consent |
| 3 | Authorize application | Redirected back to Mirror |
| 4 | Check dashboard | User info from Google displayed |

#### 2.2 Account Linking
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create account with email@example.com (email/password) | Account created |
| 2 | Sign out | Signed out |
| 3 | Sign in with Google using same email | Accounts linked, signed in |
| 4 | Check user has both auth methods | Same user ID in database |

---

### 3. Magic Link Authentication

#### 3.1 Magic Link Request
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/sign-in` | Form displayed |
| 2 | Toggle to "Magic Link" tab | Magic link form shown |
| 3 | Enter email | Form accepts input |
| 4 | Submit form | Success: "Check your email for the magic link" |
| 5 | Check email inbox | Magic link email received |

#### 3.2 Magic Link Redemption
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click magic link in email | Link opens in browser |
| 2 | Wait for redirect | Authenticated, redirected to `/dashboard` |
| 3 | Check session | User is logged in |

#### 3.3 Expired Link
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Wait >15 minutes after requesting magic link | Link expires |
| 2 | Click expired link | Error message displayed |

---

### 4. Middleware & Route Protection

#### 4.1 Protected Routes
| Route | Unauthenticated | Authenticated |
|-------|-----------------|---------------|
| `/` | Allowed | Allowed |
| `/sign-in` | Allowed | Redirect to `/dashboard` |
| `/sign-up` | Allowed | Redirect to `/dashboard` |
| `/forgot-password` | Allowed | Redirect to `/dashboard` |
| `/reset-password` | Allowed | Redirect to `/dashboard` |
| `/dashboard` | Redirect to `/sign-in` | Allowed |

#### 4.2 Redirect Preservation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Visit `/dashboard` while signed out | Redirected to `/sign-in?next=/dashboard` |
| 2 | Sign in | Redirected to `/dashboard` (from `next` param) |

---

### 5. Session Management

#### 5.1 Session Persistence
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Sign in | Session created |
| 2 | Refresh page | Still authenticated |
| 3 | Close and reopen browser | Still authenticated (14-day session) |

#### 5.2 Sign Out
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Sign out" on dashboard | Signed out |
| 2 | Session cookie cleared | Cookie removed |
| 3 | Visit `/dashboard` | Redirected to `/sign-in` |

---

### 6. Password Reset Flow

#### 6.1 Forgot Password
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/forgot-password` | Form displayed |
| 2 | Enter registered email | Form accepts input |
| 3 | Submit form | Success: "Check your email for reset link" |
| 4 | Check email inbox | Reset email received |

#### 6.2 Reset Password
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click reset link in email | `/reset-password?token=...` opens |
| 2 | Enter new password (8+ chars) | Form accepts input |
| 3 | Confirm password | Passwords match |
| 4 | Submit form | Password reset, success message |
| 5 | Sign in with new password | Works |

---

## Rate Limiting Verification

| Endpoint | Limit | Test |
|----------|-------|------|
| `/sign-in/email` | 5/min | Submit 6 attempts rapidly → Rate limited |
| `/sign-up/email` | 5/min | Submit 6 attempts rapidly → Rate limited |
| `/sign-in/magic-link` | 3/min | Submit 4 attempts rapidly → Rate limited |
| `/forget-password` | 3/min | Submit 4 attempts rapidly → Rate limited |

---

## Critical Files Reference

### Mirror App
- `apps/mirror/middleware.ts` - Route protection logic
- `apps/mirror/lib/auth-client.ts` - Client auth instance
- `apps/mirror/lib/auth-server.ts` - Server auth utilities
- `apps/mirror/app/api/auth/[...all]/route.ts` - API handler

### Convex Package
- `packages/convex/convex/auth.ts` - Better Auth config
- `packages/convex/convex/email.ts` - Email actions
- `packages/convex/convex/http.ts` - HTTP routes

### Features Package
- `packages/features/auth/components/*.tsx` - All form components
- `packages/features/auth/hooks/use-session.ts` - Session hook

---

## Execution Plan

### Phase 1: Basic Navigation & UI Verification
1. Navigate to http://localhost:3000
2. Verify landing page loads
3. Navigate to `/sign-in` and `/sign-up` pages
4. Take screenshots of auth forms
5. Verify OAuth buttons and form elements present

### Phase 2: Middleware Verification
1. Attempt to access `/dashboard` while unauthenticated
2. Verify redirect to `/sign-in?next=/dashboard`
3. Check that public routes are accessible

### Phase 3: Email/Password Sign Up
1. Navigate to `/sign-up`
2. Fill form: name, email (hpark0011@gmail.com), password
3. Submit and verify success message
4. User checks email inbox for verification link
5. Click verification link
6. Verify redirect to dashboard

### Phase 4: Email/Password Sign In
1. Sign out first
2. Navigate to `/sign-in`
3. Enter credentials
4. Verify successful sign in and redirect to dashboard

### Phase 5: Session Management
1. Refresh page while authenticated
2. Verify session persists
3. Test sign out functionality
4. Verify redirect after sign out

### Phase 6: Magic Link
1. Sign out
2. Navigate to `/sign-in`, switch to magic link tab
3. Enter email, submit
4. Check inbox for magic link
5. Click link and verify authentication

### Phase 7: Google OAuth
1. Sign out
2. Navigate to `/sign-in`
3. Click "Continue with Google"
4. Complete OAuth flow
5. Verify redirect to dashboard

### Phase 8: Password Reset
1. Navigate to `/forgot-password`
2. Enter email, submit
3. Check inbox for reset link
4. Click link, set new password
5. Verify can sign in with new password

---

## Success Criteria

- [ ] Email/password sign up works with email verification
- [ ] Email/password sign in works
- [ ] Google OAuth sign in works
- [ ] Account linking works (email + Google same user)
- [ ] Magic link authentication works
- [ ] Middleware protects routes correctly
- [ ] Session persists across refreshes
- [ ] Sign out clears session
- [ ] Password reset flow works
- [ ] Rate limiting active on auth endpoints
- [ ] No console errors during auth flows
