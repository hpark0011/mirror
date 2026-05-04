---
id: FG_145
title: "CoverImagePicker preview state stays in sync with the url prop"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "previewUrl is seeded from url only at mount; async parent updates leave the picker showing stale state."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`apps/mirror/features/articles/components/cover-image-picker.tsx` includes a `useEffect` that re-syncs `previewUrl` with the `url` prop when the prop changes (guarded against overwriting an in-progress blob URL)."
  - "Manual test: parent updates `url` from `null` to a server URL after a slow query — the picker reflects the new URL without user interaction."
  - "`pnpm build --filter=@feel-good/mirror` passes."
owner_agent: "frontend engineer (React)"
---

# CoverImagePicker preview state stays in sync with the url prop

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086678). `apps/mirror/features/articles/components/cover-image-picker.tsx:25` initializes `previewUrl` via `useState(url)`. The seeding happens once on mount; subsequent prop changes do not propagate. Line 40's `display = previewUrl ?? url` partially mitigates but doesn't handle `url` going from value to `null` (parent clear path) or from one value to another.

**Risk:** if the parent updates the `url` prop after mount (e.g., the server-side cover URL arrives from a slow Convex query while the picker is already displayed, or the parent clears the cover state), the picker continues showing the stale preview until the user takes another action.

## Goal

`previewUrl` updates whenever the `url` prop changes, except when the user has an in-progress local blob URL.

## Scope

- Add a `useEffect` that re-syncs `previewUrl` with the `url` prop.
- Guard against overwriting a `blob:` URL (which represents a local upload in progress).

## Out of Scope

- Changing the picker's UX.
- Refactoring the upload flow.

## Approach

```ts
useEffect(() => {
  setPreviewUrl((prev) => (prev?.startsWith("blob:") ? prev : url));
}, [url]);
```

This preserves an in-progress blob preview while sync'ing server-side URL changes.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/components/cover-image-picker.tsx`, add the `useEffect` shown above (just after the `useState(url)` initializer).
2. Manually verify the three cases: (a) parent clears `url` to null while no blob URL is active, (b) parent updates `url` from value-A to value-B with no blob, (c) blob URL preserved during in-progress upload.
3. Run `pnpm build --filter=@feel-good/mirror`.

## Constraints

- Do not revoke the previous `previewUrl` here — that's covered by FG_132's blob-revoke ticket.
- Do not flicker on identical `url` updates (React's setState skips re-renders for identical values).

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086678
