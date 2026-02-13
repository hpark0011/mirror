---
status: pending
priority: p3
issue_id: "171"
tags: [code-review, security, authorization, mirror]
dependencies: []
---

# isOwner = isAuthenticated() Grants Owner Access to All Auth'd Users

## Problem Statement

In `layout.tsx`, `isOwner = await isAuthenticated()` means any logged-in user viewing any profile is treated as the owner. They see draft articles and owner-only filter options. Already documented with a TODO at line 18.

## Findings

- **Location:** `apps/mirror/app/[username]/layout.tsx:18-22`
- **Note:** Known issue with existing TODO. Server component at `page.tsx` sends ALL articles (including drafts) to any authenticated user.

## Proposed Solutions

When real profiles replace MOCK_PROFILE, implement proper ownership check:
```typescript
const currentUser = await fetchAuthQuery(api.auth.getCurrentUser);
const isOwner = currentUser?._id === profile.userId;
```

- **Effort:** Medium (blocked on real profile data)

## Acceptance Criteria

- [ ] Only the actual profile owner sees draft articles and owner-only filters

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | Already has TODO in code |
