---
status: completed
priority: p1
issue_id: "037"
tags: [code-review, pr-103, auth, typescript, build-error]
dependencies: []
---

# Fix TypeScript Build Error: Stale forgotPasswordHref Prop

## Problem Statement

`LoginBlock` removed `forgotPasswordHref` from its props interface, but `apps/mirror/app/(auth)/sign-in/page.tsx` still passes it. This causes a TypeScript build failure (`TS2322`).

## Findings

**Source:** PR #103 code review (multi-agent)

**Affected Files:**
- `apps/mirror/app/(auth)/sign-in/page.tsx`
- `packages/features/auth/blocks/login-block.tsx`

**Details:**
- `LoginBlockProps` and `LoginBlockSlots` removed the `forgotPasswordHref` and password form slot in this PR
- The mirror sign-in page still passes `forgotPasswordHref="/forgot-password"` to `<LoginBlock>`
- Confirmed via `pnpm --filter @feel-good/mirror exec tsc --noEmit`:
  ```
  TS2322: Property 'forgotPasswordHref' does not exist on type 'IntrinsicAttributes & LoginBlockProps'
  ```

## Proposed Solutions

### Option A: Remove the stale prop from sign-in page (Recommended)
- **Pros:** One-line fix, restores build
- **Cons:** None
- **Effort:** Trivial
- **Risk:** None

## Recommended Action

Delete `forgotPasswordHref="/forgot-password"` from the `<LoginBlock>` usage in `apps/mirror/app/(auth)/sign-in/page.tsx`.

## Acceptance Criteria

- [x] `forgotPasswordHref` prop removed from mirror sign-in page
- [x] `pnpm --filter @feel-good/mirror exec tsc --noEmit` passes
- [ ] `pnpm build --filter=@feel-good/mirror` succeeds

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-05 | Created from PR #103 review | Pending |
| 2026-02-05 | Removed stale prop, tsc --noEmit passes | Done |
