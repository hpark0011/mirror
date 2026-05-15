---
id: FG_244
title: "Collapse per-row delete AlertDialog into a single list-level dialog"
date: 2026-05-15
type: perf
status: completed
priority: p3
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "DeletePostAction renders a Radix AlertDialog inside every owner post row, registering N root subscriptions for the lifetime of the page. With the lifted useDeletePost (FG_233), a single dialog at the list level controlled by `targetPost` state collapses N dialog roots to 1."
dependencies:
  - FG_233
acceptance_criteria:
  - "Exactly one <AlertDialog> mounts on /@<owner>/posts regardless of the number of post rows (verify by counting [role='alertdialog'] elements after rendering with no dialogs open — should be 0; after opening one, should be 1)"
  - "Existing post-list-actions delete confirm and cancel tests pass"
  - "pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts passes"
---

# Collapse per-row delete AlertDialog into a single list-level dialog

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. `apps/mirror/features/posts/components/actions/delete-post-action.tsx:43-86` wraps a Radix `AlertDialog` per row. With the per-row `useDeletePost` (see FG_233), N dialog roots mount simultaneously. The fix is the same architectural move as FG_233: lift the dialog and its state to the list level.

## Scope

- One AlertDialog at the list level driven by `{ open, targetPost }` state.
- Each row's Delete button calls a callback with `post`.

## Approach

After FG_233 lifts `useDeletePost`, also lift the AlertDialog markup. The per-row UI becomes just the trigger button. The dialog reads `targetPost` and routes its confirm through the lifted hook's `handleConfirm`.

## Implementation Steps

1. Land FG_233 first.
2. Move the AlertDialog JSX from `DeletePostAction` to a list-level component (likely the same one that hoists `useDeletePost`).
3. Replace per-row `<DeletePostConnector>` mounts with a Delete button that calls `requestDelete(post)`.
4. Run `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts post-delete.authenticated.spec.ts`.

## Constraints

- Must not regress the detail-page flow (`post-detail-toolbar.tsx`) which still uses the per-instance dialog pattern correctly.
