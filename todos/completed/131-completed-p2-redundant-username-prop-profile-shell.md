---
status: completed
priority: p2
issue_id: "131"
tags: [code-review, typescript, mirror, pr-114]
dependencies: []
---

# Redundant `username` Prop on ProfileShell

## Problem Statement

`ProfileShell` receives both `profile: Profile` (which contains `username: string`) and a separate `username: string` prop. This creates two sources of truth for the same value. If they ever diverge, the component has no way to know which is canonical. The layout validates `username !== MOCK_PROFILE.username` before rendering, so the values are guaranteed equal at the call site — but this invariant is implicit and fragile.

## Findings

- **Source:** TypeScript reviewer, pattern-recognition-specialist, architecture-strategist, code-simplicity-reviewer
- **Location:** `apps/mirror/app/[username]/_components/profile-shell.tsx` lines 16-20 (props type), `apps/mirror/app/[username]/layout.tsx` line 15 (call site)
- **Evidence:** `ProfileShellProps` declares both `profile: Profile` and `username: string`. `Profile` type already includes `username: string` (added in this PR at `features/profile/lib/mock-profile.ts`).

## Proposed Solutions

### Option A: Derive username from profile (Recommended)

Remove the standalone `username` prop from `ProfileShellProps` and derive it from `profile.username` inside the component.

```diff
 type ProfileShellProps = {
   profile: Profile;
-  username: string;
   children: React.ReactNode;
 };

-export function ProfileShell({ profile, username, children }: ProfileShellProps) {
+export function ProfileShell({ profile, children }: ProfileShellProps) {
+  const { username } = profile;
```

Layout call site:
```diff
-<ProfileShell profile={MOCK_PROFILE} username={username}>
+<ProfileShell profile={MOCK_PROFILE}>
```

- **Effort:** Small
- **Risk:** None — values are already guaranteed equal by the layout guard

## Recommended Action

Option A — straightforward removal of redundant prop.

## Technical Details

- **Affected files:** `apps/mirror/app/[username]/_components/profile-shell.tsx`, `apps/mirror/app/[username]/layout.tsx`
- **Components:** `ProfileShell`, `ProfileHeader`

## Acceptance Criteria

- [ ] `ProfileShellProps` no longer includes standalone `username` prop
- [ ] `username` is derived from `profile.username` inside `ProfileShell`
- [ ] Layout passes only `profile` to `ProfileShell`
- [ ] `ProfileHeader` still receives `username` (passed down from `ProfileShell`)
- [ ] App builds and profile page renders correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #114 code review | Single source of truth for derived data |

## Resources

- PR: #114 — feat(mirror): move profile view to public /@username route
