---
id: PLAN_014
slug: post-list-edit-delete-actions
title: "Add owner hover actions to post list items"
date: 2026-05-15
type: fix
status: active
branch: hpark0011/post-edit-delete
worktree: null
scope: "Expose existing post edit and delete flows from each owner-visible post list row without changing post routing or Convex schema."
apps: [mirror]
verification_tier: 5
---
## Goal

Profile owners should not have to open a post detail page or type an edit URL by hand. On `/@username/posts`, hovering a post list item should reveal owner-only Edit and Delete icon buttons at the item's top-right corner. Edit should navigate to the existing `/@username/posts/:slug/edit` route, preserving chat query params. Delete should reuse the existing confirmation dialog and `useDeletePost` mutation flow.

## Current State

- `apps/mirror/features/posts/components/list/post-list-item.tsx` renders the post card/list content and already routes normal post clicks through `useCloneActions().navigateToContent`, but it receives only `post` and `username`.
- `apps/mirror/features/posts/context/post-list-context.tsx` already includes `isOwner`, and `ScrollablePostList` can pass it into each row.
- `apps/mirror/app/[username]/@content/posts/[slug]/edit/page.tsx` is already owner-gated server-side and redirects non-owners back to the read view.
- `apps/mirror/features/posts/hooks/use-delete-post.ts` already performs the owner-authorized `api.posts.mutations.remove` call with an optimistic update against `posts.queries.getByUsername`.
- `apps/mirror/features/posts/components/detail/delete-post.tsx` and `delete-post-connector.tsx` are detail-folder components today, but the behavior is generic post deletion UI.
- Existing hover action precedents are `bio-entry-card.tsx` and `contact-entry-card.tsx`: owner-only actions appear on `group-hover` and `group-focus-within`.

## Implementation Steps

1. Add `isOwner?: boolean` to `PostListItemProps` and pass `context.isOwner` from `ScrollablePostList`.

2. Mark the `<article>` in `post-list-item.tsx` as the hover/focus group and stable test target:

   ```tsx
   <article
     data-testid="post-list-item"
     data-post-slug={post.slug}
     className="group/post-item relative border-b ..."
   >
   ```

3. Extract generic post actions so detail and list do not share code through a `components/detail/*` import. A small shape is enough:

   - Add `apps/mirror/features/posts/components/actions/delete-post-action.tsx`.
   - Move the reusable `DeletePost` UI there, preserving `aria-label="Delete post"`, the existing dialog copy, `data-post-deleting`, and the default `data-testid="delete-post-btn"`.
   - Let it accept optional `testId`/`className` only if the list row needs a distinct selector or compact styling.
   - Add `apps/mirror/features/posts/components/actions/delete-post-connector.tsx` or rename the existing connector in-place during the move. Keep the `useIsProfileOwner()` guard inside the connector for detail-toolbar safety.
   - Update `post-detail-toolbar.tsx` imports to the new action path.

4. Add a list-specific actions component, either in `post-list-item.tsx` if still readable or as `components/list/post-list-item-actions.tsx`:

   - Return `null` when `!isOwner`.
   - Render an absolute container at `right-4.5 top-4` or equivalent aligned with the post item's padding.
   - Use `hidden group-hover/post-item:flex group-focus-within/post-item:flex` so mouse hover reveals actions and keyboard focus inside the row also reveals them.
   - Give the container a high z-index so buttons are above cover/title links.
   - Use icon buttons with tooltips:
     - Edit: `Button asChild`, `variant="ghost"`, `size="icon-sm"`, `aria-label="Edit post"`, `data-testid="post-list-edit-btn"`, `Icon name="PencilIcon"`, `Link href={buildChatAwareHref(`/@${username}/posts/${post.slug}/edit`)}` and `scroll={false}`.
     - Delete: reuse the generic delete action/connector with `aria-label="Delete post"` and `testId="post-list-delete-btn"` if needed.

5. Keep the row's existing content navigation intact:

   - Do not wrap the whole row in a link.
   - Keep cover/title links using `handleClick` and `navigateToContent`.
   - Ensure action buttons are outside those links and stop no propagation unless a real click-through bug appears.

6. Avoid backend changes. Convex authorization already lives at the mutation boundary (`posts.mutations.remove`, `posts.mutations.update`) and the edit route already checks ownership server-side.

7. Add focused tests:

   - Component/unit coverage only if extracting the delete connector changes its public behavior. Existing `use-delete-post.test.ts` should remain valid.
   - E2E coverage for the new list surface because this is owner-only UI plus navigation/mutation behavior.

## Hard Verification

Add `apps/mirror/e2e/post-list-actions.authenticated.spec.ts`.

Use the existing fixture pattern from `post-editor.authenticated.spec.ts` and `post-delete.authenticated.spec.ts`:

```ts
const { publishedSlug } = await ensureTestPostFixtures();
await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
await waitForAuthReady(page);
const row = page.locator(
  `[data-testid="post-list-item"][data-post-slug="${publishedSlug}"]`,
);
```

Assertions:

- Owner row action buttons are hidden before hover and visible after `row.hover()`.
- Clicking `post-list-edit-btn` navigates to `/@test-user/posts/${publishedSlug}/edit`.
- Starting at `/@test-user/posts?chat=1`, clicking Edit preserves `?chat=1`.
- Clicking Delete opens the existing confirmation dialog with "Delete post" copy.
- Confirming Delete removes that row from the posts list and shows the "Post deleted" toast.
- A non-owner or unauthenticated visitor can hover the same published row and still cannot see Edit or Delete actions.

Run the targeted E2E through the Playwright CLI:

```bash
pnpm --filter=@feel-good/mirror test:e2e post-list-actions.authenticated.spec.ts
```

Then run the required Mirror verification tier:

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
```

For the visual part of Tier 5, open `/@test-user/posts` in the browser at desktop and mobile widths, confirm the owner hover actions sit at the top-right of the row, do not overlap post content, and remain reachable by keyboard focus.

## Constraints And Non-Goals

- Do not add a new edit mutation, route, or Convex schema field.
- Do not expose owner actions to visitors. UI gating is for cleanliness; server and mutation gates remain the security boundary.
- Do not change post list filtering, sorting, or existing detail navigation behavior.
- Do not add a full card overlay link; it would create nested interactive elements with the new action buttons.
- Do not rely on hover alone for accessibility. `group-focus-within` is required, and mobile/touch behavior should not block opening the post.
