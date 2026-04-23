---
id: FG_074
title: "Posts feature lib organizes parsers and schemas like sibling features"
date: 2026-04-23
type: refactor
status: completed
priority: p3
description: "apps/mirror/features/posts/lib/ holds parse-md-frontmatter.ts (138 lines) and markdown-to-json-content.ts (16 lines) directly at the lib/ root. The convention used by clone-settings, auth, and dock is lib/schemas/<name>.schema.ts for Zod schemas with parsers/adapters in their own subfolders or co-located with what they serve. Audit posts/lib/ against that convention and bring naming into line."
dependencies: []
parent_plan_id: workspace/research/convex-nextjs-client-feature-org.md
acceptance_criteria:
  - "If parse-md-frontmatter.ts contains a Zod schema, that schema lives at apps/mirror/features/posts/lib/schemas/<name>.schema.ts"
  - "Parsers in apps/mirror/features/posts/lib/ live under a clearly-named subdirectory (e.g. lib/parsers/) OR remain at lib/ root with a documented rationale in the ticket completion note — not both"
  - "grep -rn 'posts/lib/parse-md-frontmatter\\|posts/lib/markdown-to-json-content' apps/mirror returns no matches at the old path if files were moved"
  - "Convention parity is verifiable: ls apps/mirror/features/posts/lib/ produces the same shape (schemas/ subdir if applicable) as ls apps/mirror/features/clone-settings/lib/"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "general-purpose"
---

# Posts feature lib organizes parsers and schemas like sibling features

## Context

`apps/mirror/features/posts/lib/` currently contains:

- `parse-md-frontmatter.ts` (138 lines) — gray-matter parser with validation against schema constants imported from `@feel-good/convex/convex/content/schema` and the posts categories module. Returns a discriminated union result type.
- `markdown-to-json-content.ts` (16 lines) — Tiptap headless converter.

The sibling feature modules establish a clearer convention:
- `apps/mirror/features/clone-settings/lib/schemas/clone-settings.schema.ts` — Zod schema in a `lib/schemas/` subdirectory.
- `packages/features/auth/lib/schemas/auth.schema.ts` — same pattern.
- `packages/features/dock/lib/schemas/dock.schema.ts` — same pattern.

`.claude/rules/forms.md` documents `lib/schemas/<name>.schema.ts` as the schema location convention. The research report at `workspace/research/convex-nextjs-client-feature-org.md` identified posts as the single feature module that violates this pattern — its parsers live at `lib/` root with no `lib/schemas/` subdirectory.

This is the lowest-urgency item from the research report. It's a structural cleanup that brings posts into line with the sibling features.

## Goal

`apps/mirror/features/posts/lib/` follows the same shape as `apps/mirror/features/clone-settings/lib/`. Any Zod schemas live under `lib/schemas/`. Parsers live under a clearly-named location (likely `lib/parsers/` or co-located with their consumer) with a single, documented rationale.

## Scope

- Audit `parse-md-frontmatter.ts` to identify whether it contains an inline Zod schema. If it does, extract that schema to `apps/mirror/features/posts/lib/schemas/markdown-frontmatter.schema.ts` (or similar) and have the parser import it.
- Decide and apply one of two layouts for the parsers themselves:
  - (a) Move them to `apps/mirror/features/posts/lib/parsers/` so the `lib/` root is empty of code (only subdirs).
  - (b) Leave them at `lib/` root and document in the ticket completion note why — e.g., they are the only parsers and a `parsers/` subdir would be ceremony.
- Pick one; do not leave a half-migrated state.
- Update every import site for any moved files.

## Out of Scope

- Changing the parsing logic, error messages, or return types.
- Adding new schemas or new parsers.
- Refactoring `markdown-to-json-content.ts`'s Tiptap conversion logic.
- Touching the corresponding Convex schema source `packages/convex/convex/content/schema.ts`.

## Approach

Step 1: read `parse-md-frontmatter.ts` end-to-end; if there's an inline Zod schema, extract it to `lib/schemas/`. Step 2: compare `posts/lib/` vs `clone-settings/lib/` and pick the layout that produces the closest shape. Step 3: move files (if needed) and update imports. Step 4: build + lint.

If `parse-md-frontmatter.ts` doesn't contain a Zod schema (the validation may be manual length checks against constants), then the only change is the parser location decision — and the right answer might be to leave them at `lib/` root with a one-line note, since "two parsers, no schemas" is a thin justification for a `parsers/` subdir.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/features/posts/lib/parse-md-frontmatter.ts` end-to-end and identify whether validation uses Zod or hand-rolled length checks.
2. If Zod: create `apps/mirror/features/posts/lib/schemas/<name>.schema.ts` with the schema and have `parse-md-frontmatter.ts` import it.
3. Compare the resulting `posts/lib/` shape to `clone-settings/lib/`. Decide whether to move parsers under `lib/parsers/` (if there are >1 parsers and the subdir adds clarity) or leave them at `lib/` root (document why in the ticket completion note).
4. Update any import sites with `grep -rln "posts/lib/parse-md-frontmatter\|posts/lib/markdown-to-json-content"`.
5. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.

## Constraints

- Behavior of the parsers must not change — only their location and (if applicable) the schema-vs-parser split.
- Do not introduce a new dependency to do this (e.g. don't pull in Zod just to "have a schema").
- One layout decision, applied consistently — no half-migrated state.
- Do not modify `packages/convex/convex/content/schema.ts` or the categories module.

## Resources

- Research report (motivation): `workspace/research/convex-nextjs-client-feature-org.md`
- Current state: `apps/mirror/features/posts/lib/parse-md-frontmatter.ts` (138 lines), `apps/mirror/features/posts/lib/markdown-to-json-content.ts` (16 lines)
- Reference layout: `apps/mirror/features/clone-settings/lib/schemas/clone-settings.schema.ts`, `packages/features/auth/lib/schemas/`, `packages/features/dock/lib/schemas/`
- Conventions: `.claude/rules/file-organization.md`, `.claude/rules/forms.md`
