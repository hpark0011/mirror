---
id: FG_021
title: "Onboarding flow has e2e test coverage"
date: 2026-02-24
type: feature
status: completed
priority: p2
description: "Add a Playwright e2e test for the onboarding flow that verifies an authenticated user can reach /onboarding and see the username step. This catches auth provider misconfigurations (e.g., ConvexProvider not passing tokens) and missing user records before they reach production."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "File apps/mirror/e2e/onboarding.spec.ts exists"
  - "pnpm test:e2e --filter=@feel-good/mirror passes with onboarding tests green"
  - "Test navigates to /onboarding with a mocked authenticated session and asserts 'Choose your username' heading is visible"
  - "Test asserts username input field and Continue button are rendered"
  - "Test asserts no console errors containing 'Unauthenticated' or 'ConvexError' during page load"
owner_agent: "Playwright E2E Test Author"
---

# Onboarding flow has e2e test coverage

## Context

During the onboarding feature implementation (FG_014–FG_020), three bugs shipped together: the Convex provider wasn't passing auth tokens, `getCurrentProfile` threw instead of returning null for unauthenticated users, and pre-existing users had no app user record. All three went undetected because verification relied on `tsc --noEmit` and `pnpm build` — neither of which can catch runtime auth/data flow issues.

The existing e2e tests in `apps/mirror/e2e/auth.spec.ts` cover the sign-in/sign-up UI but don't test any post-authentication flow. An onboarding e2e test would have caught all three bugs in one run.

## Goal

An automated Playwright test exercises the full onboarding flow for an authenticated user, proving the Convex auth provider passes tokens and the wizard renders the username step without errors.

## Scope

- New test file `apps/mirror/e2e/onboarding.spec.ts`
- Mock or seed an authenticated Better Auth session (follow pattern from `auth.spec.ts` route mocking)
- Mock the Convex token endpoint to return a valid token
- Assert the username step UI renders
- Assert no auth-related console errors

## Out of Scope

- Testing the actual username submission or profile step (separate ticket)
- Testing unauthenticated redirect to /sign-in (already covered in `auth.spec.ts`)
- Setting up a real Convex dev deployment for e2e — use mocked responses

## Approach

Follow the existing pattern in `apps/mirror/e2e/auth.spec.ts` which uses Playwright route mocking for Better Auth endpoints. Mock both `/api/auth/get-session` (return a valid session) and `/api/auth/convex/token` (return a valid JWT). Then navigate to `/onboarding` and assert the wizard renders.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Create `apps/mirror/e2e/onboarding.spec.ts` with a `test.describe("Onboarding")` block
2. Add a `test.beforeEach` that mocks `/api/auth/get-session` to return a valid session object and `/api/auth/convex/token` to return a token
3. Write test: navigate to `/onboarding`, assert heading "Choose your username" is visible
4. Write test: assert username input and Continue button are present
5. Add console error listener that fails the test if `Unauthenticated` or `ConvexError` appears
6. Run `pnpm test:e2e --filter=@feel-good/mirror` and verify all tests pass

## Constraints

- Must follow existing e2e conventions in `apps/mirror/e2e/`
- Use route mocking, not real auth sessions — tests must run without external dependencies
- Do not add new devDependencies; `@playwright/test` is already installed

## Resources

- Existing auth tests: `apps/mirror/e2e/auth.spec.ts`
- Onboarding wizard: `apps/mirror/features/onboarding/components/onboarding-wizard.tsx`
- Lessons learned: `workspace/lessons.md` (2026-02-24 entry)
