---
id: FG_079
title: "getContentRouteState returns null for clone-settings without caller carve-out"
date: 2026-04-27
type: refactor
status: completed
priority: p2
description: "workspace-shell.tsx wraps getContentRouteState in a caller-side ternary that special-cases clone-settings. Every future caller of getContentRouteState would need to remember the same exception. Move the carve-out inside getContentRouteState so it returns null for clone-settings naturally and callers can stop encoding the policy."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -rn 'clone-settings' apps/mirror/app/\\[username\\]/_components/workspace-shell.tsx returns 0 matches"
  - "grep -rn 'clone-settings' apps/mirror/features/content/ returns at least one match in the file that defines getContentRouteState"
  - "Calling getContentRouteState with segments[0] === 'clone-settings' returns null (covered by a unit test or asserted via existing usage)"
  - "Calling getContentRouteState with segments[0] === 'posts' or 'articles' returns the same shape as before this change"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "React refactoring specialist"
---

# getContentRouteState returns null for clone-settings without caller carve-out

## Context

`apps/mirror/app/[username]/_components/workspace-shell.tsx:36-39` (current branch) reads:

```ts
const routeState: ContentRouteState | null =
  segments[0] === "clone-settings"
    ? null
    : getContentRouteState(segments);
```

This caller-side branch encodes a policy that belongs in `getContentRouteState` itself — clone-settings does not have list/sort/filter semantics, so its route state is meaningfully `null`. Every future caller (e.g., the route-data hook from FG_078) would otherwise have to remember the same special case.

`getContentRouteState` is exported from `apps/mirror/features/content/` (verify exact file via `grep -rn 'export function getContentRouteState' apps/mirror/features/content`).

## Goal

`getContentRouteState(segments)` returns `null` when the first segment is `clone-settings` (or any other non-list-bearing route kind), and callers stop encoding the rule.

## Scope

- Move the `segments[0] === "clone-settings" ? null : ...` carve-out inside `getContentRouteState`
- Remove the ternary in `workspace-shell.tsx`
- Add a brief comment in `getContentRouteState` explaining why clone-settings (and any future kindless routes) return null

## Out of Scope

- Refactoring the broader route-data computation (covered by FG_078)
- Changing the `ContentRouteState` type or fields
- Renaming `clone-settings` or relocating its route

## Approach

`getContentRouteState` already inspects `segments`. Adding a single guard at the top — `if (segments[0] === "clone-settings") return null;` — is mechanical and behavior-preserving. Then delete the caller-side branch.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Locate `getContentRouteState` (`grep -rn 'export function getContentRouteState' apps/mirror/features/content`).
2. Add an early `return null` for `segments[0] === "clone-settings"` at the top of the function. Add a one-line comment explaining the kindless-route semantics.
3. In `apps/mirror/app/[username]/_components/workspace-shell.tsx`, replace the ternary with `const routeState = getContentRouteState(segments);`.
4. `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
5. If `getContentRouteState` has unit tests, add a case asserting the clone-settings → null behavior. If not, manually verify by visiting `/@user/clone-settings` and confirming no list-related UI (sort/filter toolbar) appears.

## Constraints

- Function signature must not change — return type remains `ContentRouteState | null`
- No new exports
- The behavior at non-clone-settings segments must be byte-identical to current

## Resources

- PR #13 (current branch) — current carve-out location
- FG_078 — depends on this ticket's resolution to keep the new hook clean
