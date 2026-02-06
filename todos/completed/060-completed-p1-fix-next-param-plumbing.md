---
status: completed
priority: p1
issue_id: "060"
tags: [auth, otp, mirror, routing]
dependencies: []
---

# Fix ?next Param Plumbing in Mirror Auth Pages

## Problem Statement

The plan explicitly identified `?next` parameter handling as "broken" — Mirror sign-in/sign-up pages hardcode `redirectTo="/dashboard"` instead of reading `searchParams.next`. Users arriving from protected route redirects (e.g. `/dashboard?tab=settings`) lose their intended destination.

## Affected Files

- `apps/mirror/app/(auth)/sign-in/page.tsx`
- `apps/mirror/app/(auth)/sign-up/page.tsx`

## Current Behavior

```typescript
// Both pages hardcode:
<OTPLoginBlock authClient={authClient} redirectTo="/dashboard" />
```

## Expected Behavior (from plan Phase 7)

```typescript
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = getSafeRedirectUrl(next);
  return <OTPLoginBlock authClient={authClient} redirectTo={redirectTo} />;
}
```

## Acceptance Criteria

- [ ] `sign-in/page.tsx` reads `searchParams.next` and passes through `getSafeRedirectUrl()`
- [ ] `sign-up/page.tsx` reads `searchParams.next` and passes through `getSafeRedirectUrl()`
- [ ] E2E test "preserves redirect query param after auth redirect" validates the flow
- [ ] Fallback to `/dashboard` when no `next` param provided

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-06 | Created from plan audit | Plan Phase 7 — explicitly flagged as broken |
