---
id: FG_046
title: "Add e2e coverage for profile/chat route matrix and slot composition"
date: 2026-03-03
type: improvement
status: to-do
priority: p2
description: "The new @interaction route architecture has no dedicated e2e tests for profile/chat route matrix behavior, deep-link hydration, and refresh invariants, leaving regressions likely despite successful local builds."
dependencies:
  - FG_044
  - FG_045
parent_plan_id:
acceptance_criteria:
  - "`test -f apps/mirror/e2e/chat-routing.spec.ts` succeeds."
  - "`rg -n '/@rick-rubin$|/@rick-rubin/chat$|/@rick-rubin/chat/' apps/mirror/e2e/chat-routing.spec.ts` returns matches."
  - "`rg -n 'reload\\(|page\\.reload' apps/mirror/e2e/chat-routing.spec.ts` returns at least one match for hard-refresh verification."
  - "`rg -n 'test\\.skip|describe\\.skip' apps/mirror/e2e/chat-routing.spec.ts` returns no matches."
  - "`pnpm -C apps/mirror exec playwright test e2e/chat-routing.spec.ts --list` succeeds."
owner_agent: "Playwright route-matrix verification specialist"
---

# Add e2e coverage for profile/chat route matrix and slot composition

## Context

The profile route architecture now uses `@interaction` slot composition and route-driven pane rendering, but current e2e coverage in `apps/mirror/e2e` focuses on auth/onboarding/video-call flows only.

There are no dedicated end-to-end checks validating chat deep-link route behavior across:
- `/@username`
- `/@username/[slug]`
- `/@username/chat`
- `/@username/chat/[conversationId]`
including refresh behavior and synchronization between interaction pane and workspace pane.

This testing gap was identified in architecture review after the shell decomposition landed.

## Goal

Add deterministic e2e coverage for the profile/chat route matrix so route-driven pane composition and deep-link behavior are protected against regressions.

## Scope

- Add `apps/mirror/e2e/chat-routing.spec.ts`.
- Cover profile, article, chat base, and chat conversation routes.
- Include at least one refresh-based assertion on chat deep-link routes.

## Out of Scope

- Visual design assertions unrelated to route behavior.
- Tavus/video-call flows (already covered elsewhere).
- Backend data-model changes.

## Approach

Create a focused Playwright spec that verifies route contracts and pane behavior with stable selectors/text already present in the UI. Keep the spec narrow to architecture invariants rather than snapshot-heavy UI assertions.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Create `apps/mirror/e2e/chat-routing.spec.ts`.
2. Add tests for `/@rick-rubin`, `/@rick-rubin/[slug]` (existing seeded slug), `/@rick-rubin/chat`, and `/@rick-rubin/chat/[conversationId]`.
3. Add a hard-refresh assertion (`page.reload`) on a chat deep-link route.
4. Assert no regressions in right-pane behavior on chat routes.
5. Run `pnpm -C apps/mirror exec playwright test e2e/chat-routing.spec.ts --list`.

## Constraints

- Tests must be deterministic and avoid flaky timing assumptions.
- Use existing seeded data expectations where possible.
- Do not mark new tests as skipped.

## Resources

- `apps/mirror/app/[username]/layout.tsx`
- `apps/mirror/app/[username]/@interaction/**`
- `apps/mirror/app/[username]/chat/**`
- `apps/mirror/e2e/video-call.spec.ts` (style reference)
