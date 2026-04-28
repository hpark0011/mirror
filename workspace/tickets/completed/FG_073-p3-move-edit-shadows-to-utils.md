---
id: FG_073
title: "Profile edit-shadow CSS constants live in utils not lib"
date: 2026-04-23
type: refactor
status: completed
priority: p3
description: "apps/mirror/features/profile/lib/edit-shadows.ts holds four exported CSS box-shadow string constants. AGENTS.md and file-organization.md scope lib/ to schemas, data parsing, and adapters. Presentation-layer constants belong in utils/. Move the file and update import sites."
dependencies: []
parent_plan_id: workspace/research/convex-nextjs-client-feature-org.md
acceptance_criteria:
  - "apps/mirror/features/profile/utils/edit-shadows.ts exists"
  - "apps/mirror/features/profile/lib/edit-shadows.ts no longer exists"
  - "grep -rn 'profile/lib/edit-shadows' apps/mirror returns no matches"
  - "grep -rln 'profile/utils/edit-shadows' apps/mirror returns at least one match"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "general-purpose"
---

# Profile edit-shadow CSS constants live in utils not lib

## Context

`apps/mirror/features/profile/lib/edit-shadows.ts` (9 lines) exports four CSS box-shadow string constants for the profile edit/view states (light/dark × edit/view). Per `AGENTS.md` and `.claude/rules/file-organization.md`, `lib/` is for "Data access, adapters, schemas, mock data" — these are presentation-layer styling constants that belong in `utils/`.

The research report at `workspace/research/convex-nextjs-client-feature-org.md` flagged this as a small but representative `lib/` boundary violation: leaving it in place erodes the convention that `lib/` means "data" and `utils/` means "pure helpers."

This is the smallest of the six refactors and the lowest risk — it's a file move and an import-path update.

## Goal

The file lives at `apps/mirror/features/profile/utils/edit-shadows.ts`, all import sites are updated, and the build still passes. The convention boundary between `lib/` and `utils/` is reinforced.

## Scope

- Move `apps/mirror/features/profile/lib/edit-shadows.ts` to `apps/mirror/features/profile/utils/edit-shadows.ts`.
- Update every import that referenced the old path.
- Verify `apps/mirror/features/profile/lib/` still has remaining contents (e.g. `get-profile-initials.ts`) — do not delete the directory itself.

## Out of Scope

- Changing the constants themselves or any consuming component's styling.
- Touching `apps/mirror/features/profile/lib/get-profile-initials.ts` (correctly placed — pure string util that arguably belongs in utils too, but out of scope here).
- Other features' `lib/` cleanups.

## Approach

`git mv` the file. Run `grep -rln "profile/lib/edit-shadows" apps/mirror` to find import sites. Update each. Build + lint.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Run `git mv apps/mirror/features/profile/lib/edit-shadows.ts apps/mirror/features/profile/utils/edit-shadows.ts`.
2. Find import sites: `grep -rln "profile/lib/edit-shadows\|features/profile/lib/edit-shadows\|@/features/profile/lib/edit-shadows" apps/mirror packages`.
3. Update each import to point at `apps/mirror/features/profile/utils/edit-shadows`.
4. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.

## Constraints

- File contents must not change — this is a deletion + creation of the same constants in a new path, plus import updates.
- `apps/mirror/features/profile/lib/` directory must remain (it still contains `get-profile-initials.ts`).

## Resources

- Research report (motivation): `workspace/research/convex-nextjs-client-feature-org.md`
- Current location: `apps/mirror/features/profile/lib/edit-shadows.ts`
- Convention: `.claude/rules/file-organization.md` (lib/ is for data; utils/ is for pure helpers)
