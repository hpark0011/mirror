---
id: FG_183
title: "Rename clearCoverImage update arg to clearCover so the name matches its scope"
date: 2026-05-08
type: refactor
status: to-do
priority: p2
description: "The articles.update mutation arg clearCoverImage now clears image, video, and poster — but the name says 'image'. Public validator name lies about scope; future caller adding clearCoverVideo would create a redundant API."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'clearCoverImage' packages/convex/convex/articles/mutations.ts apps/mirror/features/articles/hooks/use-edit-article-form.tsx` returns zero matches"
  - "`grep -n 'clearCover' packages/convex/convex/articles/mutations.ts` shows the renamed arg in the validator and the handler"
  - "`pnpm --filter=@feel-good/convex test && pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form` pass"
  - "`pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build` exit 0"
owner_agent: "Convex Backend Engineer"
---

# Rename clearCoverImage Update Arg to clearCover So the Name Matches Its Scope

## Context

`articles.update` accepts `clearCoverImage: v.optional(v.boolean())` (`packages/convex/convex/articles/mutations.ts:249`). PLAN_010 widened its semantics — when `true`, the handler now wipes `coverImageStorageId`, `coverImageThumbhash`, `coverVideoStorageId`, AND `coverVideoPosterStorageId`. The arg name was kept for "backwards compat" with a comment block (lines 240-249) acknowledging the mismatch.

The arg name is a public API surface visible in:
- The validator (TypeScript type signature)
- Every call site (`use-edit-article-form.tsx:211`)
- Tests
- Any future agent tool / admin script that targets this mutation

A future caller reading the validator will infer it only clears the image cover and may add a separate `clearCoverVideo` field, producing a two-arg mutation where one is redundant.

The branch has only one caller and ~3 test references — a one-PR rename is feasible.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `packages/convex/convex/articles/mutations.ts:241-249,427-432` and `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:211`
- **Evidence:** Comment block explicitly documents the name-vs-scope mismatch and defers the rename.

## Goal

The mutation arg's name accurately describes its effect: `clearCover` clears every cover surface.

## Scope

- Rename the validator field from `clearCoverImage` to `clearCover`.
- Rename the handler reads (line 427).
- Update the sole caller `use-edit-article-form.tsx:211`.
- Update tests that reference the old name.
- Drop the explanatory comment block (lines 240-249).

## Out of Scope

- Renaming the `coverImageOwnership` table (FG_198).
- Adding a `kind` discriminator (FG_181, FG_196).
- Any other API rename in the same mutation.

## Approach

Pure rename — no behavior change. Convex validators are positional/named so renaming requires no migration on existing data, only on call sites.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/convex/convex/articles/mutations.ts:249`, rename `clearCoverImage` to `clearCover` in the validator.
2. Rename `args.clearCoverImage` to `args.clearCover` in the handler (line 427).
3. Update `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:211` to send `clearCover` instead.
4. Update test references in `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` and `packages/convex/convex/articles/__tests__/mutations.test.ts`.
5. Remove the explanatory comment block at lines 240-249 (replace with a minimal one-line comment if needed).
6. Run `pnpm --filter=@feel-good/convex test && pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form`.
7. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- This is a breaking API rename — there are no other callers in the monorepo, but if any downstream consumer (admin script, agent tool) calls `articles.update` directly, they need updating in lockstep.
- Convex's TypeScript-typed validators will surface every call site at compile time.

## Resources

- Source: `packages/convex/convex/articles/mutations.ts:249,427-432`
- Caller: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:211`
