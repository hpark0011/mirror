---
id: FG_057
title: "Vinyl toggle uses explicit CSS transition properties"
date: 2026-03-09
type: improvement
status: completed
priority: p3
description: "The DesktopContentPanelToggle in profile-panel.tsx uses transition-all which transitions every CSS property that changes, including unintended ones like color and background from theme changes. Should use explicit transition-[right] or transition-[right,opacity] to prevent unexpected jank."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep 'transition-all' apps/mirror/app/\\[username\\]/_components/profile-panel.tsx returns 0 matches"
  - "The toggle button still animates position on hover"
  - "pnpm build --filter=@feel-good/mirror succeeds"
owner_agent: "CSS optimization specialist"
---

# Vinyl toggle uses explicit CSS transition properties

## Context

In `apps/mirror/app/[username]/_components/profile-panel.tsx:45`, the toggle button uses `transition-all duration-200 ease-in-out`. This transitions every CSS property including unintended ones (color, background, box-shadow) that may change during theme switches. Using explicit property transitions prevents unexpected animation jank.

## Goal

The toggle button only transitions the properties it intends to animate (position and opacity), not all properties.

## Scope

- Replace `transition-all` with explicit `transition-[right,opacity]` in profile-panel.tsx

## Out of Scope

- Auditing other components for transition-all usage
- Changing animation timing or easing

## Approach

Replace `transition-all` with `transition-[right,opacity]` on the inner div of `DesktopContentPanelToggle`. The right property handles the position shift, opacity handles the label fade-in.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `profile-panel.tsx`, change `transition-all duration-200 ease-in-out` to `transition-[right,opacity] duration-200 ease-in-out`
2. Verify hover animation still works visually
3. Run `pnpm build --filter=@feel-good/mirror`

## Constraints

- Must preserve the existing hover animation behavior

## Resources

- `apps/mirror/app/[username]/_components/profile-panel.tsx:45`
