---
id: FG_168
title: "Post detail does not blank-flash between mutation resolve and navigation"
date: 2026-05-08
type: improvement
status: completed
priority: p2
description: "After useDeletePost awaits removePosts and before router.replace settles the new route, the Convex real-time subscription on the deleted post flips to null. PostDetailConnector returns null when post is null, so the toolbar plus content disappear for at least one frame on every successful delete. The result is a visible blank-flash. The fix is one of: a skeleton fallback in the connector, a sticky last-non-null ref so the UI stays populated until navigation completes, or reordering the success path so router.replace fires before await removePosts (Convex mutations do not depend on the originating component being mounted)."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Choose one of the three approaches in Approach below; document the choice in a one-line code comment at the top of the change."
  - "After confirming a delete on a post detail page, the post detail toolbar (the WorkspaceBackButton or a stable skeleton) remains visible the entire time until the new route paints — no frame where the content panel renders an empty <div /> or a layout-shift gap."
  - "If approach (3) is chosen: pnpm --filter=@feel-good/mirror test:unit -- use-delete-post still passes after the await order changes (FG_167's unit tests cover the path)."
  - "FG_166's e2e (post-delete.authenticated.spec.ts) does not regress — Confirm → toast → /@user/posts URL flip still passes."
  - "Verify visually via Chrome MCP at the dev server: confirm a published post; record before/after to confirm no blank flash."
  - "pnpm build --filter=@feel-good/mirror succeeds."
  - "pnpm lint --filter=@feel-good/mirror succeeds."
owner_agent: "Senior Mirror frontend engineer"
---

# Post detail does not blank-flash between mutation resolve and navigation

## Context

Code review of `feature-post-delete-button` (review-code Phase 6 finding `post-null-flash-after-delete`, P2) flagged a visible flash on every successful post delete. Sequence:

1. User confirms; `useDeletePost` calls `await removePosts({ ids: [postId] })` (`apps/mirror/features/posts/hooks/use-delete-post.ts:43`).
2. The mutation resolves — Convex's reactive layer immediately invalidates every subscription that depended on this post, including the `getById` query that `PostDetailConnector` reads.
3. `PostDetailConnector` re-renders with `post === null` and returns `null` (`apps/mirror/features/posts/components/detail/post-detail-connector.tsx:22`). The toolbar slot blanks.
4. The hook then calls `router.replace(buildChatAwareHref(getContentHref(username, "posts")))`. Next.js processes the route transition and paints the posts list.

Between steps 3 and 4 (and during the route-transition paint) the user sees an empty content panel. This is not a crash; it's a visible flash on every delete — bad enough to be a UX regression worth correcting before more flows adopt the same pattern.

The same shape will exist for any future mutation that deletes the entity the current screen is reading. Fixing it in one of the three ways below either (a) hardens the connector, (b) hardens the hook, or (c) reorders the await — and establishes the precedent for the next time this comes up (post unpublish-to-removed flow, article delete from detail, etc.).

## Goal

The post detail screen renders a stable view (existing toolbar, a skeleton fallback, or the new route's first paint) for the entire window between the user clicking Confirm and the posts list being painted. No frame shows an empty content panel or a layout-shift gap.

## Scope

- Pick one of approaches (1)/(2)/(3) below and apply the fix.
- Update a one-line code comment at the top of the changed function explaining why the chosen shape exists, so the next reader doesn't undo it.
- Verify FG_166's e2e (when it lands) still passes; if approach (3) is taken, verify FG_167's unit tests still pass after reordering.

## Out of Scope

- Changing the post-detail render path for non-delete scenarios (loading state, 404, etc.).
- Generalizing the fix to a shared hook used by every mutation-then-navigate path. Land this for posts first, then promote to `features/content/` if a third caller appears.
- Rewriting the success path to use `useTransition` or React 19's `useFormState` — possible long-term direction but not required here.
- Touching `articles` delete (the article delete path is a multi-select toolbar action, not a per-detail confirm).

## Approach

Three options, ranked by minimum diff:

**Approach 1 — Skeleton fallback in the connector.** In `post-detail-connector.tsx:22`, render a stable placeholder when `post === null` after mount (use a ref to distinguish "never had data" from "had data, now null after delete"). Pros: localized; works for any mutation that deletes the entity. Cons: introduces a "remember if we ever had data" ref; the placeholder needs to match the toolbar layout closely or the user still perceives a shift.

**Approach 2 — Sticky last-non-null ref in the hook caller.** In `post-detail-connector.tsx`, keep `lastPostRef` populated whenever the query returns non-null and render from `lastPostRef.current` while `post === null` and a delete is in-flight or recently completed. Pros: zero placeholder needed. Cons: introduces a "recently completed" window the connector has to reason about; coupling between the connector and the hook's pending state.

**Approach 3 — Reorder the success path: navigate first, then await.** In `apps/mirror/features/posts/hooks/use-delete-post.ts:42-46`, fire `router.replace(...)` synchronously before `await removePosts(...)`. Convex mutations execute server-side regardless of whether the originating React component is mounted, so unmounting the post-detail page does not cancel the delete. The user sees an instant route transition; the post is gone from the list (Convex subscription) by the time the list paints. Pros: simplest diff (~3 lines). Cons: error path is harder — if the mutation rejects, the user is already on the list page and the dialog is gone, so the error toast surfaces alone; that's actually fine for delete (success is the dominant path) but the team should confirm the reordering is acceptable for the error UX.

Recommended: approach (3) for the simplest diff and the cleanest UX, conditional on confirming the error toast remains acceptable on the list page. If the error UX is rejected, fall back to approach (1).

- **Effort:** Small
- **Risk:** Medium — approach (3) changes the error UX surface. Verify with FG_166's e2e and Chrome MCP.

## Implementation Steps

1. Read `apps/mirror/features/posts/hooks/use-delete-post.ts:37-58` and `apps/mirror/features/posts/components/detail/post-detail-connector.tsx:18-30` to confirm the current shape matches the description above.
2. Pick an approach. Default: approach (3).
3. If approach (3): in `use-delete-post.ts`, move `router.replace(buildChatAwareHref(getContentHref(username, "posts")))` to fire synchronously before `await removePosts({ ids: [postId] })`. Capture `dialogOpen` cleanup is unnecessary because the connector unmounts on the route flip. Keep the `try / catch / finally` around the mutation so the error toast still fires.
4. If approach (1): in `post-detail-connector.tsx`, return a `<PostDetailToolbarSkeleton />` (new component, mirror the toolbar slot's height) when `post === null` and `hadDataRef.current === true`. Add `useEffect(() => { if (post) hadDataRef.current = true; }, [post]);`.
5. Add the explanatory one-line comment at the changed function describing the chosen shape.
6. Verify locally: `pnpm dev:safe`, sign in, navigate to a published post, click Delete → Confirm, observe the transition for any blank frame. Use Chrome MCP if needed.
7. Run `pnpm build --filter=@feel-good/mirror`, `pnpm lint --filter=@feel-good/mirror`, and any unit/e2e tests that already cover delete (FG_166 once it lands; FG_167 for the unit guards).

## Constraints

- Do not introduce a new shared hook for "mutate-then-navigate" until a third caller exists — the codebase rule prefers three similar lines over a premature abstraction.
- The chosen approach must not regress FG_166's e2e or FG_167's unit tests once those land. If they have not landed yet, run them as part of the same branch that lands this fix.
- The comment at the top of the changed function must explain *why* the shape exists, not merely restate what the code does.
- If approach (3) is chosen, the error toast must still surface — verify by simulating a rejection in the dev environment and confirming the toast is visible on the posts list page.

## Resources

- Code review report (this branch) — Finding #4, P2 Moderate — `post-null-flash-after-delete`.
- `apps/mirror/features/posts/hooks/use-delete-post.ts` — the success path.
- `apps/mirror/features/posts/components/detail/post-detail-connector.tsx:22` — the null-render branch.
- `apps/mirror/hooks/use-chat-search-params.ts` — `buildChatAwareHref` — preserve chat-state across navigation.
- FG_166 — establishes the e2e that must keep passing.
- FG_167 — establishes the unit tests that must keep passing if approach (3) is chosen.
