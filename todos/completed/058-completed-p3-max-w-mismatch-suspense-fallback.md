---
status: completed
priority: p3
issue_id: "058"
tags: [code-review, pr-103, auth, ui, layout]
dependencies: []
---

# Fix max-w Mismatch Between Content and Suspense Fallback

## Problem Statement

`LoginBlock` and `SignUpBlock` changed their content wrapper to `max-w-sm`, but the Suspense fallback skeletons still use `max-w-md`. This creates a width mismatch during loading — the skeleton is wider than the actual content.

## Findings

**Source:** PR #103 architecture review

**Affected Files:**
- `packages/features/auth/blocks/login-block.tsx`
- `packages/features/auth/blocks/sign-up-block.tsx`

**Details:**
| Block | Content | Suspense fallback |
|-------|---------|-------------------|
| LoginBlock | `max-w-sm` (changed) | `max-w-md` (unchanged) |
| SignUpBlock | `max-w-sm` (changed) | `max-w-md` (unchanged) |
| ForgotPasswordBlock | `max-w-md` | `max-w-md` |
| ResetPasswordBlock | `max-w-md` | `max-w-md` |

## Proposed Solutions

### Option A: Update fallback skeletons to max-w-sm (Recommended)
- **Pros:** Matches content width, smooth transition
- **Cons:** None
- **Effort:** Trivial
- **Risk:** None

### Option B: Standardize all blocks to same max-w
- **Pros:** Consistent auth flow width
- **Cons:** Larger change
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [x] Suspense fallback width matches content wrapper width in all auth blocks

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-05 | Created from PR #103 architecture review | Pending |
| 2026-02-05 | Changed Suspense fallback max-w-md → max-w-sm in LoginBlock and SignUpBlock | Completed |
