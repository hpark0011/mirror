---
id: FG_053
title: "useParams typed correctly for single dynamic segment"
date: 2026-03-09
type: fix
status: completed
priority: p2
description: "useParams is typed as { username: string | string[] } in desktop-workspace.tsx and workspace-shell.tsx, but the route is [username] (single segment, not catch-all). The correct type is { username: string }. The Array.isArray guard masks potential routing bugs."
dependencies:
  - FG_052
parent_plan_id:
acceptance_criteria:
  - "grep -r 'string | string\\[\\]' apps/mirror/app/\\[username\\]/_components/ returns 0 matches"
  - "grep -r 'Array.isArray(params.username)' apps/mirror/app/\\[username\\]/_components/ returns 0 matches"
  - "pnpm build --filter=@feel-good/mirror succeeds with no type errors"
owner_agent: "TypeScript type safety specialist"
---

# useParams typed correctly for single dynamic segment

## Context

In `apps/mirror/app/[username]/_components/desktop-workspace.tsx:42` and `workspace-shell.tsx:29`, `useParams` is typed as `{ username: string | string[] }`. The route `[username]` is a single dynamic segment — Next.js only returns `string[]` for catch-all segments (`[...username]`). The defensive `Array.isArray` guard is unnecessary and masks potential routing issues.

## Goal

`useParams` uses `{ username: string }` type and no `Array.isArray` guard exists in the `[username]` route components.

## Scope

- Fix `useParams` type annotation in both files
- Remove `Array.isArray` guard and simplify `username` derivation

## Out of Scope

- Checking other routes for the same issue

## Approach

Change `useParams<{ username: string | string[] }>()` to `useParams<{ username: string }>()` and use `params.username` directly. If FG_052 is done first, this only needs to change in `workspace-shell.tsx`.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Update type in `workspace-shell.tsx` to `useParams<{ username: string }>()`
2. Replace `Array.isArray(params.username) ? params.username[0] : params.username` with `params.username`
3. If FG_052 is not yet done, also update `desktop-workspace.tsx`
4. Run `pnpm build --filter=@feel-good/mirror`

## Constraints

- Must not change runtime behavior — only type narrowing

## Resources

- Next.js useParams docs: single segment returns `string`, catch-all returns `string[]`
- `apps/mirror/app/[username]/_components/workspace-shell.tsx:29-38`
