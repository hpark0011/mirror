---
id: FG_052
title: "Extract duplicated defaultContentHref into shared hook"
date: 2026-03-09
type: refactor
status: to-do
priority: p2
description: "desktop-workspace.tsx and workspace-shell.tsx both independently compute username extraction (Array.isArray guard) and defaultContentHref (getContentHref + searchParams). This duplicated logic should be extracted to a single source of truth, either as a shared hook or by passing the value as a prop from WorkspaceShell to DesktopWorkspace."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -r 'Array.isArray(params.username)' apps/mirror/app/\\[username\\]/_components/ returns at most 1 match"
  - "grep -r 'defaultContentHref' apps/mirror/app/\\[username\\]/_components/ shows the value computed in one place only"
  - "desktop-workspace.tsx no longer imports useParams or useSearchParams (grep confirms)"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "Existing e2e tests pass"
owner_agent: "React refactoring specialist"
---

# Extract duplicated defaultContentHref into shared hook

## Context

Discovered during code review of PR #193. Both `apps/mirror/app/[username]/_components/workspace-shell.tsx:29-45` and `apps/mirror/app/[username]/_components/desktop-workspace.tsx:51-60` contain identical logic:

```typescript
const username = Array.isArray(params.username) ? params.username[0] : params.username;
const defaultContentHref = useMemo(() => {
  if (!username) return null;
  const href = getContentHref(username, DEFAULT_PROFILE_CONTENT_KIND);
  const queryString = searchParams.toString();
  return queryString ? `${href}?${queryString}` : href;
}, [searchParams, username]);
```

This duplication means changes to the URL construction logic require updating two files in lockstep.

## Goal

The `defaultContentHref` value and `username` extraction are computed in exactly one place, and `DesktopWorkspace` receives what it needs via props rather than independently reading route hooks.

## Scope

- Pass `defaultContentHref` (or an `onOpenDefaultContent` callback) as a prop from `WorkspaceShell` to `DesktopWorkspace`
- Remove `useParams`, `useSearchParams` from `desktop-workspace.tsx`
- Remove duplicated `username` and `defaultContentHref` derivation from `desktop-workspace.tsx`

## Out of Scope

- Changing the mobile redirect logic in `workspace-shell.tsx`
- Refactoring the `useRouter` call out of `desktop-workspace.tsx` (it may still need router for other purposes)

## Approach

The cleanest approach is to pass an `onOpenDefaultContent: (() => void) | null` callback prop from `WorkspaceShell` to `DesktopWorkspace`. `WorkspaceShell` already computes `defaultContentHref` and has `useRouter`, so it defines the callback there. `DesktopWorkspace` calls it when needed, keeping it a pure layout/panel-state manager. This eliminates 3 hook calls and ~15 lines from `desktop-workspace.tsx`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add `onOpenDefaultContent: (() => void) | null` to `DesktopWorkspaceProps`
2. In `workspace-shell.tsx`, create the callback: `const openDefaultContent = defaultContentHref ? () => router.push(defaultContentHref) : null`
3. Pass `onOpenDefaultContent={openDefaultContent}` to `<DesktopWorkspace>`
4. In `desktop-workspace.tsx`, remove `useParams`, `useSearchParams`, `username`, `defaultContentHref`, and `openDefaultContentRoute`
5. Replace `openDefaultContentRoute()` calls with `onOpenDefaultContent?.()`
6. Update `useCallback` dependency arrays accordingly
7. Run `pnpm build --filter=@feel-good/mirror` and e2e tests

## Constraints

- `DesktopWorkspace` must not import route-parsing hooks after this change
- The `useRouter` in `desktop-workspace.tsx` can be removed if it's only used for `openDefaultContentRoute`

## Resources

- PR #193: https://github.com/anthropics/feel-good/pull/193
- `apps/mirror/app/[username]/_components/desktop-workspace.tsx:42-73`
- `apps/mirror/app/[username]/_components/workspace-shell.tsx:29-45`
