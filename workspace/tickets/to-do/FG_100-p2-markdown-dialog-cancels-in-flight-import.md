---
id: FG_100
title: "Markdown-upload dialog cancels in-flight import or guards setState after close"
date: 2026-05-02
type: fix
status: to-do
priority: p2
description: "markdown-upload-dialog-connector handleClose calls resetCreator() synchronously while handleConfirm may still be awaiting importMarkdownInlineImages. The action eventually resolves and calls setImportStatus('done') / setImportResult on the now-reset hook state, racing whatever the user did next. isSubmittingRef guards re-entry into handleConfirm but does not prevent the in-flight promise from continuing past close."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "useCreatePostFromFile (or its caller) holds an AbortController or mounted-ref that is checked after every await in createPost — setState calls after close are no-ops"
  - "New unit test in apps/mirror/features/posts/__tests__/use-create-post-from-file.test.ts: trigger createPost, immediately call resetCreator (simulating dialog close), then resolve the action — assert no setState fires after reset"
  - "Existing import flow tests still pass"
  - "pnpm --filter=@feel-good/mirror build passes"
  - "Manual: open markdown-upload dialog, drop a markdown file with images, close the dialog mid-import — no console errors, no stale state"
owner_agent: "React / hook lifecycle specialist"
---

# Markdown-upload dialog cancels in-flight import or guards setState after close

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #13, julik-frontend-races reviewer at confidence 0.72.

`apps/mirror/features/posts/components/markdown-upload-dialog-connector.tsx:76-82` `handleClose` calls `resetCreator()` synchronously, which resets `importStatus` to `'idle'` and `importResult` to `null` inside `useCreatePostFromFile`.

`apps/mirror/features/posts/components/markdown-upload-dialog-connector.tsx:84-110` `handleConfirm` calls `await createPost(...)`, which internally calls `await importMarkdownInlineImages(...)`. The action takes 1–60+ seconds (depending on image count and network).

If the user clicks Cancel (which fires `handleClose`) while `handleConfirm` is mid-await:

1. `resetCreator()` runs — state goes back to idle.
2. The await in `handleConfirm` resolves.
3. `useCreatePostFromFile` continues: `setImportStatus('importing')` → `setImportResult(...)` → `setImportStatus('done')`.
4. These setState calls run on a hook whose state was just reset, racing whatever the user is now doing.

If the dialog stays mounted (typical Radix Dialog behavior), the user sees a flash of "Imported 3 of 3 images" or similar after they cancelled.

`isSubmittingRef.current = false` is set in the finally block of `handleConfirm` and in `handleClose` — but this flag only gates re-entry, not in-flight propagation.

## Goal

After this ticket, closing the dialog while an import is in flight either cancels the action or silences any further setState calls from it. No console errors, no stale state flashes.

## Scope

- `apps/mirror/features/posts/hooks/use-create-post-from-file.ts` — add cancellation primitive (mounted-ref or AbortController).
- `apps/mirror/features/posts/components/markdown-upload-dialog-connector.tsx` — call `cancelImport()` on close.
- Vitest case in `__tests__/use-create-post-from-file.test.ts`.

## Out of Scope

- Aborting the underlying Convex action mid-flight (Convex doesn't support abort) — server-side import will still complete, leaving images stored. Cron sweep handles orphans if the post was never committed.
- Surfacing "import canceled" messaging to the user — silent abort is fine.

## Approach

Add a `cancelledRef` (or `useRef(false)` + cleanup) to `useCreatePostFromFile`. After each `await` in `createPost`, check `cancelledRef.current` and short-circuit setState calls if true. Expose a `cancelImport()` function from the hook that sets the ref. Call it from `handleClose`.

```ts
// inside useCreatePostFromFile
const cancelledRef = useRef(false);
useEffect(() => () => { cancelledRef.current = true; }, []);

async function createPost(...) {
  cancelledRef.current = false;
  setImportStatus('importing');
  const result = await importMarkdownInlineImages(...);
  if (cancelledRef.current) return;
  setImportResult(result);
  setImportStatus('done');
}

function cancelImport() {
  cancelledRef.current = true;
}

return { createPost, cancelImport, resetCreator, ... };
```

In the connector, call `cancelImport()` from `handleClose` before `resetCreator()`.

- **Effort:** Small
- **Risk:** Low — additive, opt-in via the new method.

## Implementation Steps

1. In `apps/mirror/features/posts/hooks/use-create-post-from-file.ts`, add `cancelledRef` and `cancelImport()` as described.
2. Guard each setState in `createPost` after an await with `if (cancelledRef.current) return;`.
3. Export `cancelImport` from the hook.
4. In `apps/mirror/features/posts/components/markdown-upload-dialog-connector.tsx` `handleClose`, call `cancelImport()` before `resetCreator()`.
5. Add Vitest in `apps/mirror/features/posts/__tests__/use-create-post-from-file.test.ts` simulating close-during-await.
6. Run all tests and build.

## Constraints

- Do not block the dialog from closing — cancellation is fire-and-forget.
- The Convex action's server-side completion is not blocked — only client-side state propagation is silenced.
- No new abort-controller surface to the Convex client (Convex doesn't support it as of this writing).

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #13.
- `apps/mirror/features/posts/components/markdown-upload-dialog-connector.tsx:76-110` — the race site.
- `apps/mirror/features/posts/hooks/use-create-post-from-file.ts` — the hook to extend.
