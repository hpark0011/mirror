---
id: FG_190
title: "Article detail and featured-card need unit tests for video-wins render precedence"
date: 2026-05-08
type: fix
status: completed
priority: p2
description: "The hasCoverVideo || hasCoverImage precedence JSX has no unit test that renders the component with coverVideoUrl set and asserts a video element is in the DOM. E2E indirectly covers it but only when the (until FG_178) untracked MP4 fixture exists."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "A new test in apps/mirror/features/articles/components/list/__tests__/article-list-featured.test.tsx renders FeaturedArticleCard with coverVideoUrl set + coverImageUrl set, asserts data-testid='article-list-cover-video' is present and the image is NOT rendered"
  - "A parallel test for article-detail.tsx asserts data-testid='article-detail-cover-video' is present when coverVideoUrl is set"
  - "Tests assert the four required attributes (autoPlay, loop, muted, playsInline) are set on the rendered video element"
  - "`pnpm --filter=@feel-good/mirror test:unit -- article-list-featured article-detail` passes"
owner_agent: "QA Test Engineer"
---

# Article Detail and Featured-Card Need Unit Tests for Video-Wins Render Precedence

## Context

Two components implement the render-precedence rule "video wins over image":

- `article-detail.tsx:29-33` — `hasCoverVideo = !!article.coverVideoUrl; hasCover = hasCoverVideo || hasCoverImage`. The `<video>` block (lines 63-77) renders when `hasCoverVideo`; otherwise the `<Image>` block (lines 79-95) renders.
- `article-list-featured-card.tsx:53-55` — same logic. The `<video>` block (lines 80-99) renders when `hasCoverVideo`; otherwise the `<Image>` block (lines 102-118) renders.

The existing tests (`apps/mirror/features/articles/components/list/__tests__/article-list-featured.test.tsx`) cover the image-only case and the no-cover case. There is NO test that asserts video-wins-over-image when both are set (which is impossible per server-side mutual exclusion, but the JSX guard is what enforces correctness if a malformed query result ever arrives).

The e2e (`apps/mirror/e2e/article-cover-video.authenticated.spec.ts`) covers it indirectly — but only when the MP4 fixture exists (FG_178 — until then, the e2e silently skips).

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/features/articles/components/{detail/article-detail.tsx,list/article-list-featured-card.tsx}`
- **Evidence:** Test file exercises image-only and no-cover paths; no video case.

## Goal

Each render-precedence component has a fast unit test that catches a regression flipping the JSX condition. The test runs in CI without depending on the e2e fixture.

## Scope

- Add `it('renders <video> when coverVideoUrl is set, even if coverImageUrl is also set')` to `article-list-featured.test.tsx`.
- Add a parallel test for `article-detail.tsx` (creating a new test file if none exists).
- Each test asserts the four required `<video>` attributes (`autoPlay`, `loop`, `muted`, `playsInline`).

## Out of Scope

- Performance tests (FG_172).
- E2E parity (covered by FG_178).
- Testing the picker's local preview branch (separate component).

## Approach

```tsx
// article-list-featured.test.tsx
it("renders <video> when coverVideoUrl is set, even if coverImageUrl is also set (video wins)", () => {
  const article = makeArticle({
    coverImageUrl: "https://example.com/img.jpg",
    coverVideoUrl: "https://example.com/v.mp4",
    coverVideoPosterUrl: "https://example.com/p.jpg",
  });
  render(<FeaturedArticleCard article={article} username="t" variant="image-first" />);
  const video = screen.getByTestId("article-list-cover-video");
  expect(video).toBeInTheDocument();
  expect(video).toHaveAttribute("autoplay");
  expect(video).toHaveAttribute("loop");
  expect(video).toHaveAttribute("muted");
  expect(video).toHaveAttribute("playsinline");
  // Image must NOT render even though coverImageUrl is set.
  expect(screen.queryByAltText("")).not.toBeInTheDocument();
});
```

For `article-detail.tsx`, use the `data-testid="article-detail-cover-video"` selector and the same attribute assertions.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/components/list/__tests__/article-list-featured.test.tsx`, add the new test next to the existing image-cover render test.
2. Create `apps/mirror/features/articles/components/detail/__tests__/article-detail.test.tsx` (or add to an existing test file if one exists) with the parallel test.
3. Mock any required context (`useChatSearchParams`, `useCloneActions`) following the existing patterns in the test files.
4. Run `pnpm --filter=@feel-good/mirror test:unit -- article-list-featured article-detail`.
5. Run `pnpm --filter=@feel-good/mirror lint`.

## Constraints

- Don't replace `next/image` with a real image fetch in tests — the existing test file mocks it.
- The `<video>` element should be queried by data-testid, not tag, to match the e2e expectation.

## Resources

- Source: `apps/mirror/features/articles/components/detail/article-detail.tsx:63-95`
- Source: `apps/mirror/features/articles/components/list/article-list-featured-card.tsx:80-118`
- Existing test pattern: `article-list-featured.test.tsx`
