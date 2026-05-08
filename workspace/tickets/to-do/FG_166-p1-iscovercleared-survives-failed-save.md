---
id: FG_166
title: "isCoverCleared flag persists across failed saves and silently wipes server cover"
date: 2026-05-08
type: fix
status: to-do
priority: p1
description: "After a failed update mutation in the article editor, the local isCoverCleared flag stays true, so the next save (even an unrelated title-only edit) re-sends clearCoverImage:true and erases the cover the server preserved through the prior failure."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'setIsCoverCleared(false)' apps/mirror/features/articles/hooks/use-edit-article-form.tsx` shows the reset inside both the success path AND the failure path (catch / before-throw)"
  - "A new test in `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` reproduces the bug: handleCoverClear → mockUpdate.mockRejectedValueOnce → save (fails) → save (succeeds) — asserts the second save does NOT include clearCoverImage:true"
  - "`pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form` passes"
  - "`pnpm --filter=@feel-good/mirror lint` exits 0"
owner_agent: "Convex + React Hooks Engineer"
---

# isCoverCleared Flag Persists Across Failed Saves and Silently Wipes Server Cover

## Context

`useEditArticleForm` accumulates a boolean `isCoverCleared` flag whenever the user clicks Remove on the cover. The flag is only reset to `false` AFTER `await update(...)` succeeds (`apps/mirror/features/articles/hooks/use-edit-article-form.tsx:227-229`). If the update mutation throws (network drop, slug collision, auth expiry), the catch in `save()` shows a toast but leaves `isCoverCleared = true`.

The user dismisses the toast and edits something unrelated — say the title — and saves again. `persistValidated` reads the flag (`use-edit-article-form.tsx:211`) and sends `clearCoverImage: true`. The server-side `articles.update` Branch 1 wipes every cover surface (image, image-thumbhash, video, poster) AND deletes every prior blob via `safeDeleteStorage`. The user never explicitly clicked Remove again — the cover wipe is a ghost of the failed first save.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:87,211,227-229`
- **Evidence:** `setIsCoverCleared(false)` only appears inside the post-await success block; no reset path on failure.

## Goal

A failed `update` followed by any subsequent save preserves the article's existing server cover. `clearCoverImage:true` is sent ONLY when the user clicked Remove in the same save session.

## Scope

- Reset `isCoverCleared` on the failure path of `persistValidated` so the flag does not survive across saves.
- Add a hook-level regression test covering the failed-save → second-save pattern.

## Out of Scope

- Refactoring the local cover state machine into a derived signal (worth doing later but larger change).
- Touching `useNewArticleForm` — that hook does not carry an `isCoverCleared` flag because it has no pre-existing cover to clear.

## Approach

Capture `isCoverCleared` into a local variable at the top of `persistValidated`, reset the state to `false` immediately, and pass the captured value into the `update` call. If the call throws, the user's "I clicked Remove" intent is preserved in the captured local but the global flag is already false — a successful retry will see clean state. If the call succeeds, behavior is identical to today.

Alternative: keep the current flag lifecycle but add `setIsCoverCleared(false)` to the catch in `save()`. Slightly less robust because the flag would leak between renders, but lower-risk.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:187`, capture `const wasCoverCleared = isCoverCleared;` at the start of `persistValidated`, then call `setIsCoverCleared(false)` immediately.
2. Replace `clearCoverImage: isCoverCleared ? true : undefined` (line 211) with `clearCoverImage: wasCoverCleared ? true : undefined`.
3. Remove the now-redundant `if (isCoverCleared) { setIsCoverCleared(false); }` block at lines 227-229.
4. Add a test in `apps/mirror/features/articles/hooks/__tests__/use-edit-article-form.test.ts` (next to the existing "save sends clearCoverImage:true" test) that mocks `mockUpdate.mockRejectedValueOnce(new Error("fail"))`, calls `handleCoverClear`, calls `save()`, then mocks success and calls `save()` again — asserts the second `mockUpdate` call args do NOT include `clearCoverImage`.
5. Run `pnpm --filter=@feel-good/mirror test:unit -- use-edit-article-form`.
6. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Behavior must be unchanged on the happy path: a single Remove + Save still sends `clearCoverImage:true` once.
- Do not introduce a new ref to track the captured value — closure variable is sufficient and avoids stale-ref hazards.

## Resources

- Source line: `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:211`
- Server-side handler: `packages/convex/convex/articles/mutations.ts:427-432` (Branch 1 of cover patch)
