---
id: FG_125
title: "Editing the title of an existing article does not overwrite its slug"
date: 2026-05-05
type: fix
status: to-do
priority: p1
description: "On the article edit form, typing in the title field auto-regenerates and overwrites the existing slug because the dirty-ref defaults to false even when a slug is already set."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`apps/mirror/features/articles/components/article-metadata-header.tsx:62` initialises `slugDirtyRef` from the incoming `slug` prop, not unconditionally to `false`."
  - "A Vitest test renders `ArticleMetadataHeader` with `slug='existing-slug'` and `title='Existing Title'`, fires a change event on the title input, and asserts `onSlugChange` was NOT called."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` pass."
owner_agent: "frontend engineer (React)"
---

# Editing the title of an existing article does not overwrite its slug

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit as a Major (PR thread r3180086673). `apps/mirror/features/articles/components/article-metadata-header.tsx:62` declares `const slugDirtyRef = useRef(false)` unconditionally. The same component is reused by both the new-article and edit-article forms. In edit mode the `slug` prop is non-empty (seeded from `initial.slug` at `use-edit-article-form.tsx:46`), but the ref starts `false`, so the first title keystroke executes the auto-derive branch at lines 67-79 and calls `onSlugChange(generateSlug(newTitle))` — silently renaming the slug the user never touched.

**Risk:** editing the title of a published article on every Save changes its canonical URL, breaking inbound links and any external/embedding references keyed to the old slug.

## Goal

A pre-populated slug on the edit form is treated as already-user-set; subsequent title edits do not modify it.

## Scope

- Initialise `slugDirtyRef` from the `slug` prop in `ArticleMetadataHeader`.
- Add a regression test covering the edit-mode mount path.

## Out of Scope

- Reworking the slug derivation logic itself.
- Slug-change UX (warning users about URL-breaking renames) — separate ticket.

## Approach

Change `useRef(false)` to `useRef(slug.trim().length > 0)`. The ref is only computed on first mount, which is correct: subsequent prop changes shouldn't reset the ref because the user may have actively cleared the slug to re-enable auto-derive.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `apps/mirror/features/articles/components/article-metadata-header.tsx:62` from `useRef(false)` to `useRef(slug.trim().length > 0)`.
2. Add a test case to `apps/mirror/features/articles/components/__tests__/article-metadata-header.test.tsx` that renders with `slug='existing-slug'` and `title='Existing'`, fires a title change to `'Updated'`, and asserts `onSlugChange` mock was not called.
3. Run `pnpm --filter=@feel-good/mirror test:unit -- article-metadata-header`.

## Constraints

- Do not break the new-article auto-derive path: when `slug=''` initially, the ref must still start `false` so typing a title fills the slug field.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086673
