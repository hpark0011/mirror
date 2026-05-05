---
id: FG_153
title: "Article editor paste/drop no longer reaches inline-image upload plugin after editor refactor"
date: 2026-05-05
type: fix
status: to-do
priority: p0
description: "After the b0aa3cf3 article-editor refactor, pasting or dropping an image into the article editor no longer inserts an `<img>` node — the synthetic ClipboardEvent dispatched against `.tiptap-content .ProseMirror` does not reach `inline-image-upload-plugin`'s `handlePaste`. Discovered while verifying FG_094: post-flow paste still works, only article-flow paste/drop is broken. Blocks FG_094 (acceptance criteria 2/3/5) and silently regresses FR-01/02/03/06/07 in production."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "`pnpm --filter=@feel-good/mirror test:e2e -- article-inline-image-paste` passes (4/4 tests, including 'paste a PNG into the editor renders inline and persists on save')."
  - "`pnpm --filter=@feel-good/mirror test:e2e -- article-inline-image-drop` passes."
  - "`pnpm --filter=@feel-good/mirror test:e2e -- article-inline-image-replace` passes."
  - "`pnpm --filter=@feel-good/mirror test:e2e -- article-inline-image-cascade-delete` passes."
  - "`pnpm --filter=@feel-good/mirror test:e2e -- post-inline-image-paste` passes (mirror of article paste; same suspect host element)."
  - "`pnpm --filter=@feel-good/mirror test:e2e -- inline-image` reports 16/16 tests green across all 8 specs."
  - "Root cause is documented in a code comment co-located with the fix (e.g. on the contenteditable mount or the plugin registration) so a future editor refactor cannot reintroduce it without seeing the warning."
owner_agent: "frontend engineer (React + ProseMirror)"
---

# Article editor paste/drop no longer reaches inline-image upload plugin after editor refactor

## Context

Discovered during FG_094 verification (2026-05-05). The Convex client-auth race that originally blocked the inline-image E2E specs is genuinely fixed — `auth.setup.ts` succeeds, `waitForAuthReady(page)` resolves, and `post-markdown-image-import.authenticated.spec.ts` runs 4/4 green. But the article-editor paste/drop specs still fail with a different signature: the synthetic `ClipboardEvent` is dispatched, the editor receives focus, and yet no `<img>` is inserted into the document. Locator log: `5 × locator resolved to <img alt="" class="ProseMirror-separator"/>` — only ProseMirror's empty-paragraph separator imgs exist. No `Unauthenticated` error.

**Suspected cause:** the article editor refactor on `feature-article-editor` (`b0aa3cf3 refactor(editor): align article editor with greyboard structure`, plus follow-ups `d678c0c5`, `1e7e7a6f`, `4c5f44a6`) introduced `packages/features/editor/components/article-rich-text-editor.tsx` as the new article-editor host. Both the `inline-image-upload-plugin` extension (`article-rich-text-editor.tsx:109`) and the plugin's `handlePaste` (`packages/features/editor/lib/inline-image-upload-plugin.ts:233`) appear correctly wired, so the failure is most likely structural: the test scaffolding dispatches the synthetic event at `.tiptap-content .ProseMirror`, but in the new article-editor mount the contenteditable that ProseMirror is actually listening on may be a different node, or a wrapping element is intercepting / re-dispatching the event in a way ProseMirror doesn't recognise.

Strongest evidence the regression is article-editor-specific: `post-markdown-image-import` (different code path) passes; the article-editor paste/drop/replace/cascade-delete and `post-inline-image-paste` all fail with the same "no `<img>` inserted" symptom.

**Production risk (why p0):** the article publish flow now silently swallows pasted/dropped images. A user who composes an article by pasting screenshots will save an article with no images; nothing in the UI signals failure. The existing E2E suite was the only safety net for FR-01/02/03/06/07 and it is currently bypassed.

## Goal

`handlePaste` and `handleDrop` in `inline-image-upload-plugin` fire when a user (or test) pastes/drops an image file into the article editor on this branch, and the resulting `<img>` is inserted at the caret/drop position with the upload pipeline running to completion.

## Scope

- Diagnose why the synthetic `ClipboardEvent` dispatched at `.tiptap-content .ProseMirror` no longer reaches the plugin.
- Apply the minimum fix at the editor host (`article-rich-text-editor.tsx`) or the plugin registration site so the test selector matches the contenteditable ProseMirror is actually listening on.
- Add a defensive code comment naming the failure mode.

## Out of Scope

- Rewriting the inline-image upload pipeline.
- Changing the existing test selector convention (`.tiptap-content .ProseMirror`) — every spec uses it; a one-off fix-by-renaming would just relocate the trap.
- Touching the post editor (only fix it if the same root cause demonstrably affects `post-inline-image-paste` after the article fix lands).

## Approach

1. **Reproduce.** Run `pnpm --filter=@feel-good/mirror test:e2e -- article-inline-image-paste` against this worktree (the dev server PID 48332 from `feature-empty-bio` was killed during FG_094 verification — confirm 3001 is free again).
2. **Inspect the rendered DOM.** Open the edit page in Chrome MCP and snapshot the editor mount. Compare the structure under `.tiptap-content .ProseMirror` to what the post editor (which works) produces. Look for: a wrapping `div` between `.tiptap-content` and the actual contenteditable; a different element type for the contenteditable; `editorProps.attributes` that move the `tiptap-prose` class onto an inner node; any pointer-events / event-stopping wrapper.
3. **Verify the listener target.** Add a temporary `console.log` inside the plugin's `handlePaste` to confirm whether it fires at all. If it never fires, the dispatch isn't reaching ProseMirror's view; if it fires but returns early, `event.clipboardData.files` is empty (a different bug).
4. **Fix at the host.** Likely candidates:
   - The synthetic event needs to dispatch on the actual contenteditable node (the inner one ProseMirror owns), not a wrapper. Either (a) make `.tiptap-content .ProseMirror` resolve to the contenteditable directly (move `tiptap-content` onto the EditorContent's outer span and let `.ProseMirror` be the contenteditable as before), or (b) update `editorProps.attributes` to put a stable selector on the actual contenteditable.
   - If a wrapping element added by the refactor is swallowing the paste event before bubbling, remove that listener or stop intercepting `paste`/`drop`.
5. **Add the comment.** Once the fix lands, comment the contenteditable mount with: "test scaffolding dispatches synthetic ClipboardEvent at this exact selector — see FG_153."

- **Effort:** Small once diagnosed (likely a single CSS-class or DOM-structure relocation).
- **Risk:** Low to fix; high if shipped without it (silent data loss on every published article with pasted images).

## Implementation Steps

1. Confirm 3001 is free; spin up dev for THIS worktree (`pnpm --filter=@feel-good/mirror dev`) or let Playwright's `webServer` config spawn it.
2. Reproduce the failure with `pnpm --filter=@feel-good/mirror test:e2e -- article-inline-image-paste` and capture which test step times out and the locator log.
3. Use Chrome MCP to load `/@<test-user>/articles/<draft-slug>/edit`, snapshot the editor mount, and compare the DOM hierarchy beneath `.tiptap-content` against the post editor's mount.
4. Patch `packages/features/editor/components/article-rich-text-editor.tsx` (and only this file unless the diagnosis demands deeper changes) so the test selector matches the contenteditable ProseMirror listens on.
5. Re-run all six acceptance commands above. Confirm 16/16 green.
6. Add the inline comment naming FG_153 and the failure mode.
7. Run `pnpm --filter=@feel-good/mirror lint` and `pnpm --filter=@feel-good/mirror build` to ensure no regression.

## Constraints

- Do not modify the test scaffolding (`apps/mirror/e2e/article-inline-image-*` specs) to work around the bug — the fix belongs in the editor host. Adapting tests to a broken DOM is exactly what FG_094's lessons.md entry warns against.
- Do not change `.tiptap-content .ProseMirror` as the public selector — every authenticated spec uses it. The fix is to make that selector resolve correctly, not to introduce a new one.
- Once this lands, FG_094 should be re-verified and promoted (its other ACs already pass).

## Resources

- FG_094 verifier report (2026-05-05) — the diagnosis that surfaced this regression.
- `packages/features/editor/components/article-rich-text-editor.tsx` — the new article-editor host.
- `packages/features/editor/lib/inline-image-upload-plugin.ts:233` — `handlePaste` definition.
- `apps/mirror/e2e/article-inline-image-paste.authenticated.spec.ts:91-113` — the synthetic ClipboardEvent dispatch the test uses.
- `apps/mirror/e2e/post-markdown-image-import.authenticated.spec.ts` — the working baseline for comparison.
- `b0aa3cf3 refactor(editor): align article editor with greyboard structure` — suspected origin commit.
