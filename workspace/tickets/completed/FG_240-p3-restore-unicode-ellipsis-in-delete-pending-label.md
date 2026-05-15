---
id: FG_240
title: "Restore Unicode ellipsis in delete-post pending label"
date: 2026-05-15
type: fix
status: completed
priority: p3
branch: hpark0011/post-edit-delete
verification_tier: 1
description: "The rename of detail/delete-post.tsx → actions/delete-post-action.tsx silently replaced the Unicode ellipsis 'Deleting…' (U+2026) with three ASCII dots 'Deleting...'. The PR was a rename, not a content edit — this cosmetic change adds noise to the rename diff and would silently break any test that pattern-matches on the original character."
dependencies: []
acceptance_criteria:
  - "grep -n 'Deleting' apps/mirror/features/posts/components/actions/delete-post-action.tsx returns the line with the Unicode ellipsis character (U+2026), not three ASCII full stops"
  - "pnpm build --filter=@feel-good/mirror passes"
---

# Restore Unicode ellipsis in delete-post pending label

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. `apps/mirror/features/posts/components/actions/delete-post-action.tsx:82` reads `{isPending ? "Deleting..." : "Delete"}` (three ASCII dots). The original `apps/mirror/features/posts/components/detail/delete-post.tsx` (pre-rename) used `Deleting…` (U+2026). The rest of the codebase consistently uses U+2026 for ellipses.

## Scope

- Replace the three ASCII dots with the Unicode ellipsis character.

## Approach

One-character edit. Keeps the rest of the codebase consistent (every other pending-state label uses U+2026).

## Implementation Steps

1. Edit `apps/mirror/features/posts/components/actions/delete-post-action.tsx:82`: change `"Deleting..."` → `"Deleting…"`.
2. Run `pnpm build --filter=@feel-good/mirror`.
