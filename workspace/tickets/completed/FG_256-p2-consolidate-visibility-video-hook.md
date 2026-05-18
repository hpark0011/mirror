---
id: FG_256
title: "Visibility-gated video playback logic exists in one place"
date: 2026-05-18
type: refactor
status: completed
priority: p2
description: "The extracted useVisibilityGatedVideoPlayback hook is a byte-identical copy of a private function still living inside the articles featured card, and its own comment admits it mirrors that copy and will drift."
dependencies: []
acceptance_criteria:
  - "`grep -rl 'rootMargin: \"200px\"' apps/mirror/features` returns exactly one source file"
  - "apps/mirror/features/articles/components/list/article-list-featured-card.tsx imports the shared hook and defines no local visibility-gated playback function"
  - "The `// Mirrors …` comment is gone from the shared hook"
  - "`pnpm --filter=@feel-good/mirror build` and `pnpm --filter=@feel-good/mirror lint` pass"
---

# Visibility-gated video playback logic exists in one place

## Context

This branch moved `useVisibilityGatedVideoPlayback` out of `post-list-item.tsx` into `apps/mirror/features/posts/hooks/use-visibility-gated-video-playback.ts`. That hook is byte-for-byte identical to a still-private, unexported function inside `apps/mirror/features/articles/components/list/article-list-featured-card.tsx` (same IntersectionObserver config, `rootMargin: "200px"`, two-state pattern, muted-autoplay catch). The new hook's comment literally says `// Mirrors useVisibilityGatedVideoPlayback in articles/...`.

Found in code review (maintainability reviewer, confidence 0.90). "Mirrors" means "will drift" — a browser-compat fix to the observer logic would have to be applied twice. The compounding move is to delete the copy and share one hook.

## Scope

- Make `article-list-featured-card.tsx` consume the shared hook; delete its private copy.
- Remove the "Mirrors …" comment from the shared hook.

## Approach

Pick the shared location (keep `apps/mirror/features/posts/hooks/` or promote to `apps/mirror/hooks/` if a cross-feature location reads better — check both call sites first). Repoint the articles featured card at the shared export.

## Implementation Steps

1. Read both call sites: the new hook and `article-list-featured-card.tsx`'s private function.
2. Decide the shared module location; move/keep accordingly.
3. Import the shared hook in `article-list-featured-card.tsx`; delete the local function.
4. Remove the `// Mirrors …` comment from the hook.
5. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.
