---
title: "Mirror app layout architecture assessment"
type: plan
date: 2026-02-13
---

# Mirror App Layout Architecture Assessment Plan

## Summary

Assess whether the current Mirror architecture is well-constructed for the two-space model:

- Agent interaction space (left)
- Content management workspace (right with fixed navbar + toolbar and scrolling content)

Current code signals:

1. Split-space shell exists in `/Users/disquiet/Desktop/feel-good/apps/mirror/app/[username]/_components/profile-shell.tsx`.
2. Fixed workspace toolbar is not shell-enforced because `ArticleToolbar` is inside feature content in `/Users/disquiet/Desktop/feel-good/apps/mirror/features/articles/components/scrollable-article-list.tsx`.
3. Ownership boundary is currently incorrect (`isOwner = isAuthenticated`) in `/Users/disquiet/Desktop/feel-good/apps/mirror/app/[username]/layout.tsx`.
4. E2E coverage does not yet validate layout architecture contracts (`/Users/disquiet/Desktop/feel-good/apps/mirror/e2e/auth.spec.ts` is auth-focused).

## Assessment Criteria

1. Space boundary integrity
2. Workspace shell contract (fixed navbar + fixed toolbar + scrolling content)
3. Route/module scalability for future content types
4. Authorization and role isolation
5. Agent-to-workspace actionability
6. Responsive parity (desktop/mobile semantics)
7. Operational quality (tests enforce architecture invariants)

## Assessment Method

For each criterion, score 0-5 using:

- 0: absent
- 1-2: partial / brittle
- 3: acceptable baseline
- 4: strong and extensible
- 5: robust with enforced invariants and tests

Weighting:

- Shell contract + boundaries: high
- Auth boundary correctness: high
- Module scalability: medium-high
- Agent actionability: medium-high
- Responsive parity and tests: medium

## Public Interfaces/Types to Define (Spec-Level)

1. `WorkspaceShellSlots`

- `agentPane`
- `resizer`
- `navbar` (fixed)
- `toolbar` (fixed/contextual)
- `content` (scrolling)

2. `WorkspaceModuleDefinition`

- `moduleId`
- `routePattern`
- `toolbarRenderer`
- `contentRenderer`
- `permissions`

3. `AgentWorkspaceAction`

- `actionId`
- `capability`
- `inputSchema`
- `permissionGuard`
- `sideEffects`

4. `ProfileAccessPolicy`

- `viewerRole`
- `isOwner`
- `canSeeDrafts`
- `canManageContent`

## Scenario Tests

1. Reader opens profile list view and cannot access owner-only controls.
2. Owner opens own profile and can access owner-only controls.
3. Workspace navbar/toolbar remain fixed while content scrolls.
4. List/detail route transitions preserve shell contract.
5. Add a sample second module (e.g., video) and measure architecture touch points.
6. Trigger equivalent content actions via UI path and agent action path.
7. Mobile mode preserves same space semantics.
8. Unauthorized users cannot access owner-only data.

## Deliverables

1. Architecture scorecard (criterion + score + evidence path).
2. Gap list with severity and file anchors.
3. Refactor roadmap:

- Phase A: shell slot ownership and fixed-region enforcement
- Phase B: owner/access policy hardening
- Phase C: module registry and agent action interface

## Assumptions and Defaults

1. This plan evaluates architecture readiness, not visual design polish.
2. Current route model remains (`/[username]`, `/(protected)/dashboard`) unless future decision changes it.
3. Desktop keeps two-pane interaction with resizable handle.
4. Mobile may change physical layout, but must preserve logical space contracts.
