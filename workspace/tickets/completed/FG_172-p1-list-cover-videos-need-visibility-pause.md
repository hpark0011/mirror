---
id: FG_172
title: "Article list video covers must pause when scrolled offscreen"
date: 2026-05-08
type: perf
status: completed
priority: p1
description: "Every featured article card with a video cover renders autoPlay loop muted unconditionally with no IntersectionObserver-based pause. A profile with N video-cover articles spins up N concurrent hardware-decoder sessions even when most cards are offscreen, pegging mobile CPU/GPU."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "`grep -n 'IntersectionObserver\\|useInView' apps/mirror/features/articles/components/list/article-list-featured-card.tsx` shows visibility-based play/pause control"
  - "A vitest test mocks IntersectionObserver, asserts the video has `autoPlay=false` initially and that play() is called only after isIntersecting becomes true"
  - "Manual Chrome MCP check on a list with 5+ video covers confirms only visible cards have decoding video; offscreen videos are paused (verified via DevTools Performance trace)"
  - "`pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build` exit 0"
owner_agent: "React Performance Engineer"
---

# Article List Video Covers Must Pause When Scrolled Offscreen

## Context

`FeaturedArticleCard` (`apps/mirror/features/articles/components/list/article-list-featured-card.tsx:88-99`) renders the cover video with `autoPlay loop muted playsInline` unconditionally:

```tsx
<video
  src={article.coverVideoUrl!}
  poster={article.coverVideoPosterUrl ?? undefined}
  preload="metadata"
  autoPlay
  loop
  muted
  playsInline
  …
/>
```

The list does not virtualize and there is no IntersectionObserver gating playback. A prolific author with N video-cover articles produces N simultaneously-decoding H.264 streams on the page — saturates mobile hardware decoder, pegs CPU/GPU, drains battery, and makes the page unresponsive. The pre-existing `IntersectionObserver` in `article-list-loader.tsx` is for pagination sentinel detection, not playback.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/components/list/article-list-featured-card.tsx:88-99`
- **Evidence:** No play/pause control logic anywhere in the card.

## Goal

Only video covers in the viewport are actively decoding. Offscreen cards either don't decode at all or pause as soon as they leave the viewport. The page stays responsive on mobile with N+ video-cover articles.

## Scope

- Wrap the `<video>` element in an IntersectionObserver-based hook that drives play/pause via a ref.
- Replace `autoPlay` with imperative `video.play()` gated on visibility.
- Add a vitest test mocking IntersectionObserver.

## Out of Scope

- List virtualization (separate, larger concern).
- Detail-page video — single-element-on-page is fine to autoplay.
- The picker preview — also single-element.

## Approach

Add a small custom hook `useAutoPlayWhenVisible(rootMargin?: string)` that returns a `ref` and a `boolean isVisible`. The card uses the ref on the `<video>` and an effect that calls `video.play()` when `isVisible` flips true and `video.pause()` when it flips false. Drop `autoPlay` and remove the data-testid handling for the imperative path (still need the data-testid for e2e).

Reference: an existing hook may already exist in `apps/mirror/hooks/` or `packages/utils/`. Check before reimplementing.

- **Effort:** Medium
- **Risk:** Medium (touches a list-render hot path; ensure SSR safety with the `IntersectionObserver` browser-only check)

## Implementation Steps

1. Search the codebase for an existing `useInView` or `useIntersectionObserver` hook (`grep -rn 'IntersectionObserver' apps/mirror/hooks packages/utils`).
2. If none exists, add `apps/mirror/hooks/use-in-view.ts` returning `{ ref, isVisible }` with a `rootMargin: "200px"` default so playback starts slightly before the card enters the viewport.
3. In `article-list-featured-card.tsx`, replace `autoPlay` with the hook-driven imperative play/pause.
4. Add a vitest test that mounts the card, mocks IntersectionObserver, asserts `video.play()` fires only after `isIntersecting=true`.
5. Manual Chrome MCP verification: open a profile with 5+ video covers, scroll, confirm via DevTools Performance trace that only visible videos are decoding.
6. Run `pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror build`.

## Constraints

- Must be SSR-safe — `IntersectionObserver` is browser-only. Use a `useState` + `useEffect` pattern that defaults to `false` server-side.
- Must preserve the `data-testid="article-list-cover-video"` for the existing e2e network response wait.
- Must not break the detail-page autoplay (separate component).

## Resources

- Source: `apps/mirror/features/articles/components/list/article-list-featured-card.tsx:80-99`
- Pattern reference: `article-list-loader.tsx` already uses IntersectionObserver for sentinel detection.
