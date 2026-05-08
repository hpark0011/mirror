---
id: FG_193
title: "Remove dead posterBlobUrlRef from edit/new article form hooks (or document why it's null)"
date: 2026-05-08
type: refactor
status: to-do
priority: p3
description: "posterBlobUrlRef is declared, cleaned up on unmount, and only ever assigned null. No code path creates a poster blob URL — the cleanup branch is permanently a no-op. use-new-article-form documents the intent in a comment; use-edit-article-form does not, leaving future readers to hunt for the missing assignment."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "Either: posterBlobUrlRef and its unmount cleanup branch are removed from both hooks (preferred), OR use-edit-article-form gains a comment matching use-new-article-form's explanation"
  - "`grep -n 'posterBlobUrlRef' apps/mirror/features/articles/hooks/use-edit-article-form.tsx apps/mirror/features/articles/hooks/use-new-article-form.tsx` matches the chosen approach (zero references for removal, or a comment block explaining intent)"
  - "Existing unit tests still pass"
owner_agent: "React Hooks Engineer"
---

# Remove Dead posterBlobUrlRef From Edit/New Article Form Hooks (Or Document Why It's Null)

## Context

`posterBlobUrlRef` is declared in both `useEditArticleForm` (line 97) and `useNewArticleForm` (line 93) as `useRef<string | null>(null)`. The unmount effect checks `posterBlobUrlRef.current?.startsWith('blob:')` and revokes the URL. The flag is reset to `null` on every upload/clear path.

Searching both files: no code path ever assigns `posterBlobUrlRef.current` a non-null value. `use-new-article-form.tsx:148-150` documents the intent:

> "Poster URL stays null locally — the picker shows the video itself as the preview, and the server-resolved poster URL arrives on the next reactive query tick after save."

`use-edit-article-form.tsx` has the same code shape but no comment. A future reader will hunt for the missing assignment, suspect a regression, and either insert one incorrectly or waste time verifying it's intentional.

This is dead infrastructure today (no leak, since no blob URL is created), but it's a maintainability landmine.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:97-108` and `use-new-article-form.tsx:93-105`
- **Evidence:** Ref is declared, cleaned up, never assigned anything but null.

## Goal

The ref's status (intentionally null forever, OR ready to receive a real URL when the feature lands) is unambiguous.

## Scope

- Pick the simpler treatment for the current state.
- **Preferred:** delete `posterBlobUrlRef` and its unmount cleanup branch from both hooks.
- **Alternative:** add a clarifying comment to `use-edit-article-form.tsx` mirroring the new-form comment.

## Out of Scope

- Implementing a local poster preview (separate feature).
- Refactoring the broader blob-URL lifecycle.

## Approach

Recommend deletion. The ref serves no purpose today and its cleanup is a no-op. If a future ticket introduces a local poster preview, the developer can re-add the ref alongside the assignment. Maintaining inert state for a hypothetical future use is the YAGNI anti-pattern.

- **Effort:** Small
- **Risk:** Low (deletion of inert code)

## Implementation Steps

1. In `use-edit-article-form.tsx`, delete the `posterBlobUrlRef` declaration (line 97), the unmount-cleanup branch (lines 105-107), and every `posterBlobUrlRef.current = null` assignment.
2. In `use-new-article-form.tsx`, do the same — delete the ref + cleanup + assignments.
3. Run `pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form use-new-article-form`.
4. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Don't introduce a separate ref for the video blob URL — that one IS used and must stay.
- If a future ticket needs to track poster blob URLs (e.g., when a local poster preview is added), re-introduce the ref alongside its assignment site.

## Resources

- Source: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:97-108,132,179`
- Source: `apps/mirror/features/articles/hooks/use-new-article-form.tsx:93-105,148,152`
