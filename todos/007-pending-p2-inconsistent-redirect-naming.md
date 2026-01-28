---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, consistency, auth]
dependencies: []
---

# Inconsistent Redirect Parameter Naming

## Problem Statement

Auth form components use four different naming conventions for redirect URLs: `redirectTo`, `redirectURL`, `callbackURL`, and `nextUrl`. This inconsistency makes the API confusing and harder to use.

## Findings

**Parameter Names Across Components:**

| File | Prop Name | Internal Variable |
|------|-----------|-------------------|
| sign-in-form.tsx | `redirectTo` | `nextUrl` |
| forgot-password-form.tsx | `redirectURL` | `redirectURL` |
| reset-password-form.tsx | `redirectTo` | `redirectTo` |
| magic-link-form.tsx | `callbackURL` | `redirectUrl` |

## Proposed Solutions

### Option A: Standardize to `redirectTo` (Recommended)

**Pros:** Matches Next.js conventions, most commonly used in codebase
**Cons:** Breaking change for consumers
**Effort:** Small
**Risk:** Low

## Recommended Action

Rename all redirect props to `redirectTo` for consistency.

## Technical Details

**Affected Files:**
- `packages/features/auth/components/sign-in-form.tsx`
- `packages/features/auth/components/forgot-password-form.tsx`
- `packages/features/auth/components/reset-password-form.tsx`
- `packages/features/auth/components/magic-link-form.tsx`
- `packages/features/auth/components/oauth-buttons.tsx`

## Acceptance Criteria

- [ ] Rename all redirect props to `redirectTo`
- [ ] Update internal variables to be consistent
- [ ] Update all usages in Mirror app
- [ ] TypeScript compiles without errors

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P2 consistency issue |

## Resources

- Files in `packages/features/auth/components/`
