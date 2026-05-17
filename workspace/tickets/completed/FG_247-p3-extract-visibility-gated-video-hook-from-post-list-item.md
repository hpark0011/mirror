---
id: FG_247
title: "Extract useVisibilityGatedVideoPlayback hook out of post-list-item.tsx"
date: 2026-05-15
type: refactor
status: completed
priority: p3
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "post-list-item.tsx is 190 lines — well above the ~100-line guideline in .claude/rules/react-components.md. The inline useVisibilityGatedVideoPlayback hook (lines 29-70) is explicitly documented as mirroring a sibling hook in articles/list/article-list-featured-card.tsx, making it a clear extraction candidate. This is pre-existing but the current PR grew the file further."
dependencies: []
acceptance_criteria:
  - "useVisibilityGatedVideoPlayback lives in apps/mirror/features/posts/hooks/use-visibility-gated-video-playback.ts (or a shared location with the articles equivalent)"
  - "post-list-item.tsx is under 150 lines after the extraction"
  - "Existing video playback behavior is unchanged: Chrome MCP confirms cover videos still pause when scrolled out of viewport"
  - "pnpm build --filter=@feel-good/mirror and pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts pass"
---

# Extract useVisibilityGatedVideoPlayback hook out of post-list-item.tsx

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete` (flagged as pre-existing — predates this PR but the PR grew the file further). `apps/mirror/features/posts/components/list/post-list-item.tsx` is 190 lines; `.claude/rules/react-components.md` calls for ≤100 lines. Lines 29-70 host `useVisibilityGatedVideoPlayback`, an `IntersectionObserver`-based pause/play hook with an inline comment noting it duplicates a sibling hook in `articles/list/article-list-featured-card.tsx`.

## Scope

- Move the hook to its own file under `apps/mirror/features/posts/hooks/`.
- Consider deduplicating with the articles equivalent (out of scope for this ticket; track separately if desired).

## Approach

Lift the hook body verbatim into `apps/mirror/features/posts/hooks/use-visibility-gated-video-playback.ts` and import it back. The behavior must be unchanged — keep `rootMargin: "200px"` and the muted-autoplay catch.

## Implementation Steps

1. Create `apps/mirror/features/posts/hooks/use-visibility-gated-video-playback.ts` with the hook body verbatim.
2. Import it in `apps/mirror/features/posts/components/list/post-list-item.tsx` and delete the inline definition.
3. Run `pnpm build --filter=@feel-good/mirror` and `pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts`.
4. Chrome MCP: scroll through `/@test-user/posts` and confirm cover videos pause/play with viewport visibility.

## Out of Scope

- Sharing the hook with `articles/list/article-list-featured-card.tsx` — that's a separate dedup ticket.
