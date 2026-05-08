---
id: FG_187
title: "Extract video-preview branch out of cover-image-picker.tsx (185 lines, over threshold)"
date: 2026-05-08
type: refactor
status: to-do
priority: p2
description: "cover-image-picker.tsx grew from 131 (already over the ~100-line threshold) to 185 lines. Video preview block, ActivePreview union, and activeFromProps helper are extractable into a sibling cover-video-preview.tsx so the picker becomes the orchestration shell only."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`wc -l apps/mirror/features/articles/components/editor/cover-image-picker.tsx` returns under 130 (down from 185)"
  - "A new file apps/mirror/features/articles/components/editor/cover-video-preview.tsx exists exporting the video JSX block"
  - "The ActivePreview discriminated-union type lives next to the new component"
  - "`pnpm --filter=@feel-good/mirror test:unit -- cover-image-picker` and existing `article-metadata-header` tests pass"
  - "`pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build` exit 0"
owner_agent: "React Component Engineer"
---

# Extract Video-Preview Branch Out of cover-image-picker.tsx (185 Lines, Over Threshold)

## Context

`cover-image-picker.tsx` was 131 lines on `main` (already over the ~100-line guidance in `.claude/rules/react-components.md`). This PR added ~54 lines of video-branch logic (the `ActivePreview` discriminated-union type, the `activeFromProps` helper, the conditional `<img>` vs. `<video>` preview rendering), bringing the file to 185 lines.

The video preview is conceptually separable: it has its own preview JSX, its own attributes (`autoPlay loop muted playsInline poster preload`), and its own data-testid. The picker's job is the orchestration: file input, isUploading state, blob URL lifecycle, Replace/Remove buttons. Mixing the two concerns inflates the picker beyond the threshold.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/components/editor/cover-image-picker.tsx`
- **Evidence:** 185 lines; rule says ~100; pre-existing overage made worse.

## Goal

The picker is back near (or under) the ~100-line threshold. Video-preview rendering lives in a dedicated sibling component that can be unit-tested in isolation.

## Scope

- Create `apps/mirror/features/articles/components/editor/cover-video-preview.tsx` exporting a small `<CoverVideoPreview>` component.
- Move the `ActivePreview` discriminated-union type to a shared location (next to the new component).
- Move `activeFromProps` to the new component or keep in picker if still needed.
- Picker imports and renders `<CoverVideoPreview>` for the video case.

## Out of Scope

- Extracting the image preview (much smaller branch, not worth a separate component).
- Refactoring the entire picker into a state-machine library.
- Hoisting `isUploading` into the parent (FG_186).

## Approach

```tsx
// cover-video-preview.tsx
"use client";

interface CoverVideoPreviewProps {
  url: string;
  posterUrl: string | null;
}

export function CoverVideoPreview({ url, posterUrl }: CoverVideoPreviewProps) {
  return (
    <video
      data-testid="article-cover-video-preview"
      src={url}
      poster={posterUrl ?? undefined}
      preload="metadata"
      autoPlay
      loop
      muted
      playsInline
      className="block h-auto w-full object-contain"
    />
  );
}
```

The picker imports `<CoverVideoPreview>` and renders it inside the existing `active.kind === "video"` branch. The `ActivePreview` type stays in the picker (or moves to a `types.ts` if shared elsewhere).

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Create `apps/mirror/features/articles/components/editor/cover-video-preview.tsx` with the component above.
2. Update `cover-image-picker.tsx` to import and render `<CoverVideoPreview>` in place of the inline `<video>` JSX.
3. Confirm the existing data-testid (`article-cover-video-preview`) still resolves — it's used in the e2e (`apps/mirror/e2e/article-cover-video.authenticated.spec.ts:105,178`).
4. Run `pnpm --filter=@feel-good/mirror test:unit -- cover-image-picker` and `article-metadata-header` (the latter renders the picker through TestHarness).
5. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- The data-testid must be preserved exactly to keep the e2e working.
- Don't break the parent's blob-URL lifecycle — the new component receives `url` as a prop, doesn't manage its own.

## Resources

- Source: `apps/mirror/features/articles/components/editor/cover-image-picker.tsx`
- Rule: `.claude/rules/react-components.md` (~100-line guidance)
