---
id: FG_018
title: "Onboarding wizard step 1 lets users choose a unique username"
date: 2026-02-24
type: feature
status: to-do
priority: p1
description: "Create the /onboarding route with a multi-step wizard. Step 1 presents a username input with @ prefix visual, real-time availability checking via debounced Convex query, client-side format validation (lowercase alphanumeric + hyphens, 3-30 chars), and reserved username blocking. On submit, calls users.setUsername mutation. Page also handles redirect logic: if profile is already complete, redirects to /@{username}."
dependencies:
  - FG_016
  - FG_017
parent_plan_id: docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md
acceptance_criteria:
  - "`apps/mirror/app/(protected)/onboarding/page.tsx` exists and renders a client component wizard"
  - "Username input shows `@` prefix visual and validates format: lowercase alphanumeric + hyphens, 3-30 chars, no leading/trailing hyphens"
  - "Real-time availability check calls `users.isUsernameTaken` query (debounced) and shows taken/available feedback"
  - "Reserved usernames from `apps/mirror/lib/reserved-usernames.ts` are rejected client-side before querying Convex"
  - "Continue button calls `users.setUsername` mutation and advances to step 2 on success"
  - "Page queries `users.getCurrentProfile` on mount — if `onboardingComplete === true`, redirects to `/@{username}`"
  - "`pnpm build --filter=@feel-good/mirror` succeeds with no type errors"
owner_agent: "React Frontend Engineer"
---

# Onboarding wizard step 1 lets users choose a unique username

## Context

After authentication, users are redirected to `/onboarding` (FG_017). This page needs to:
1. Check if the user already has a complete profile — if so, redirect to their profile
2. Show a multi-step onboarding wizard
3. Step 1: username selection with real-time validation

The backend queries and mutations exist in `packages/convex/convex/users.ts` (FG_016). The onboarding page is a protected route under `apps/mirror/app/(protected)/`.

Existing protected route pattern from `apps/mirror/app/(protected)/dashboard/layout.tsx:1-14` uses server-side auth check via `isAuthenticated()`.

## Goal

New users see a username selection form at `/onboarding`. The form validates format, checks availability in real-time, blocks reserved names, and saves the username via Convex mutation. Users with completed profiles are redirected to their profile page.

## Scope

- Create `apps/mirror/app/(protected)/onboarding/page.tsx` — server component wrapper with auth check
- Create `apps/mirror/features/onboarding/` feature module with:
  - `components/onboarding-wizard.tsx` — client component managing wizard steps
  - `components/username-step.tsx` — step 1 form UI
  - `hooks/use-username-availability.ts` — debounced availability check hook
- Wire up redirect logic (profile complete → `/@{username}`)

## Out of Scope

- Step 2 (avatar + bio) — FG_019
- Wizard animations or transitions between steps
- Server-side username validation (Convex mutation handles it as final gate)

## Approach

The page component is a server component that checks auth (same pattern as dashboard layout). It renders a client component `OnboardingWizard` that:
1. Queries `users.getCurrentProfile` via Convex's `useQuery`
2. If profile complete, calls `router.replace(\`/@${username}\`)`
3. If not, determines the current step (no username → step 1, has username → step 2)
4. Step 1 uses `react-hook-form` + `zod` for client validation, a custom hook for debounced availability checking

The availability hook uses Convex's `useQuery` with the username as an arg, debounced at ~300ms. Show visual feedback: checkmark for available, X for taken, spinner while checking.

- **Effort:** Large
- **Risk:** Medium — first feature module in `features/onboarding/`, need to follow file-organization convention

## Implementation Steps

1. Create `apps/mirror/features/onboarding/` directory structure: `components/`, `hooks/`
2. Create `hooks/use-username-availability.ts` — debounced Convex query wrapper for `users.isUsernameTaken`
3. Create `components/username-step.tsx` — form with `@` prefix input, validation, availability feedback, continue button
4. Create `components/onboarding-wizard.tsx` — manages step state, queries `getCurrentProfile`, handles redirect logic
5. Create `apps/mirror/app/(protected)/onboarding/page.tsx` — server component with auth guard, renders wizard
6. Add barrel export `apps/mirror/features/onboarding/index.ts`
7. Run `pnpm lint --filter=@feel-good/mirror && pnpm build --filter=@feel-good/mirror`

## Constraints

- Follow file-organization convention: `features/onboarding/components/`, `features/onboarding/hooks/`
- Use `react-hook-form` + `zod` for form handling (consistent with auth forms in `@feel-good/features`)
- Use `@feel-good/ui/primitives/form` components (Input, Label, FormField)
- Username validation regex: `/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/` (3-30 chars, no leading/trailing hyphens)
- Check `isReservedUsername()` client-side before querying Convex

## Resources

- PRD: `docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md` (Sections 4.1, 4.2, 4.4)
- Protected route pattern: `apps/mirror/app/(protected)/dashboard/layout.tsx`
- Reserved usernames: `apps/mirror/lib/reserved-usernames.ts`
- Session hook: `packages/features/auth/hooks/use-session.ts`
- File organization: `.claude/rules/file-organization.md`
