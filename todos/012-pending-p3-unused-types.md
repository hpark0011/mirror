---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, yagni, cleanup]
dependencies: []
---

# Unused Type Definitions in types.ts

## Problem Statement

Several type definitions in `types.ts` are defined but never imported anywhere in the codebase, violating YAGNI principles.

## Findings

**File:** `packages/features/auth/types.ts`

**Unused Types:**
- `AuthUser` (lines 1-9) - not imported anywhere
- `AuthSession` (lines 11-14) - not imported anywhere
- `AuthError` interface (lines 20-23) - not imported anywhere
- `AuthProvider` type (line 16) - not imported anywhere

**Duplicate Types:**
- `User` and `Session` in `use-session.ts` (lines 6-16) duplicate the purpose of `AuthUser` and `AuthSession`

## Proposed Solutions

### Option A: Remove Unused Types (Recommended)

**Pros:** Cleaner codebase, follows YAGNI
**Cons:** May need to add back later
**Effort:** Small
**Risk:** Low

Keep only:
- `AuthStatus` (used by all forms)
- `AUTH_ERROR_MESSAGES` (used by all forms)
- `getAuthErrorMessage` (used by all forms)

### Option B: Consolidate and Use
Update components to use the existing types.

**Pros:** Consistent types
**Cons:** More work
**Effort:** Medium
**Risk:** Low

## Recommended Action

Remove unused types; they can be added back when needed.

## Technical Details

**Affected Files:**
- `packages/features/auth/types.ts`
- `packages/features/auth/hooks/use-session.ts`

## Acceptance Criteria

- [ ] Remove unused AuthUser, AuthSession, AuthError, AuthProvider
- [ ] Consolidate User/Session types in use-session.ts
- [ ] TypeScript compiles without errors
- [ ] Reduce types.ts from ~41 lines to ~20 lines

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P3 YAGNI violation |

## Resources

- File: `packages/features/auth/types.ts`
