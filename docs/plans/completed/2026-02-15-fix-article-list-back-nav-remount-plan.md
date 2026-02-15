---
title: "fix: Lift ArticleWorkspaceProvider to ProfileShell"
type: fix
date: 2026-02-15
issue: "207"
brainstorm: docs/brainstorms/2026-02-15-article-list-back-nav-perf-brainstorm.md
---

# fix: Lift ArticleWorkspaceProvider to ProfileShell

## Overview

Back navigation from article detail to article list has a noticeable pause because `ArticleWorkspaceProvider` lives in `page.tsx` and remounts from scratch on every route change. Moving it into `ProfileShell` (the persistent layout-level client component) eliminates the remount entirely — all workspace state (search, filter, sort, pagination, selection, scroll position) survives list <-> detail navigation.

## Problem Statement

`ArticleWorkspaceProvider` is rendered inside `app/[username]/page.tsx`. When a user navigates to `app/[username]/[slug]/page.tsx`, the provider unmounts. On back navigation, it remounts and reinitializes 5 hooks, rebuilds the searchable articles array, and mounts 30 list items fresh. This work overlaps with the 300ms slide-back animation, causing visible jank.

The layout (`ProfileShell`) persists across sibling route changes in Next.js App Router — anything placed there survives navigation.

## Proposed Solution

Lift `ArticleWorkspaceProvider` from `page.tsx` into `ProfileShell`. The layout server component already computes `isOwner` and has access to `MOCK_ARTICLES` — it passes the filtered articles array to `ProfileShell`, which wraps `{children}` in the provider.

### Phase 1: Add articles to layout → ProfileShell data flow

**`apps/mirror/app/[username]/layout.tsx`**

Compute the filtered articles array (currently done in `page.tsx`) and pass it to `ProfileShell` as a new `articles` prop.

```tsx
import { MOCK_ARTICLES } from "@/features/articles";

export default async function ProfileLayout({ children, params }) {
  const { username } = await params;
  // ... existing validation ...
  const isOwner = await isAuthenticated();
  const articles = isOwner
    ? MOCK_ARTICLES
    : MOCK_ARTICLES.filter((a) => a.status === "published");

  return (
    <ProfileShell profile={MOCK_PROFILE} isOwner={isOwner} articles={articles}>
      {children}
    </ProfileShell>
  );
}
```

**`apps/mirror/app/[username]/_components/profile-shell.tsx`**

Add `articles` prop to `ProfileShellProps`. Wrap children in `ArticleWorkspaceProvider` inside the existing `ProfileProvider`. Use `profile.username` for the `username` prop (already available).

```tsx
import { ArticleWorkspaceProvider } from "@/features/articles";

type ProfileShellProps = {
  profile: Profile;
  isOwner: boolean;
  articles: Article[];
  children: React.ReactNode;
};

export function ProfileShell({ profile, isOwner, articles, children }) {
  // ... existing code ...
  return (
    <ProfileProvider value={contextValue}>
      <ArticleWorkspaceProvider articles={articles} username={profile.username}>
        {/* existing mobile/desktop layout unchanged */}
      </ArticleWorkspaceProvider>
    </ProfileProvider>
  );
}
```

Provider placement: **inside** `ProfileProvider` (required — `ArticleWorkspaceProvider` calls `useIsProfileOwner()` which reads `ProfileProvider` context) and **outside** the mobile/desktop conditional rendering (so it wraps both layouts).

### Phase 2: Simplify page.tsx

**`apps/mirror/app/[username]/page.tsx`**

Remove `ArticleWorkspaceProvider` wrapper. The page becomes a thin shell rendering toolbar and list — both already consume context from the provider that now lives in `ProfileShell`.

```tsx
import { ArticleToolbarView, ScrollableArticleList } from "@/features/articles";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";

export default function ProfilePage() {
  return (
    <>
      <WorkspaceToolbar>
        <ArticleToolbarView />
      </WorkspaceToolbar>
      <ScrollableArticleList />
    </>
  );
}
```

Key changes:
- No longer async (no `await params`, no `await isAuthenticated()`)
- No longer imports `MOCK_ARTICLES` or `ArticleWorkspaceProvider`
- No longer needs `params` prop at all
- Just renders the two context consumers

### Phase 3: Verify detail page is unaffected

**`apps/mirror/app/[username]/[slug]/page.tsx`** — no changes needed.

The detail page is now wrapped by `ArticleWorkspaceProvider` (via ProfileShell), but nothing on the detail page consumes `ArticleToolbarContext` or `ArticleListContext`. The provider's hooks still run, but since articles/username don't change between navigations, all memoized values remain stable — zero wasted work.

## Technical Considerations

### Provider wrapping the detail route

The provider will wrap the detail page even though nothing consumes its contexts there. This is intentional and harmless:
- React contexts with no consumers have no render cost
- The provider's internal hooks (`useArticleSearch`, etc.) keep their memoized state stable since `articles` doesn't change
- This is the same pattern as `ProfileProvider` already wrapping both routes

### ScrollRootProvider stays where it is

`ScrollRootProvider` is currently wired inside ProfileShell's mobile/desktop conditional branches (not in `ArticleWorkspaceProvider`). This doesn't change — scroll root management remains in ProfileShell, independent of the provider lift.

### `page.tsx` becomes a non-async server component

With `isAuthenticated()` and `params` removed from page.tsx, it becomes a synchronous server component with no data fetching. This eliminates the server-side round-trip on back navigation entirely.

### ToolbarSlotProvider portal pattern

The `WorkspaceToolbar` uses `createPortal` to render toolbar content into a target div managed by `ToolbarSlotProvider` (in ProfileShell). The portal preserves React context inheritance, so `ArticleToolbarView` will still read from `ArticleToolbarContext` correctly — even though the DOM target is in ProfileShell while the context provider is also in ProfileShell. This already works today and is unaffected by the change.

### Selection state survives navigation

Checkbox selection state (multi-select for delete) will now persist when navigating to a detail page and back. This is the desired behavior per the brainstorm decision ("preserve everything").

### Known pre-existing issue: desktop scroll root

The desktop layout in ProfileShell does not wrap children in `ScrollRootProvider` (only mobile does). This is a pre-existing issue unrelated to this change — `useScrollRoot()` returns `null` on desktop, and `IntersectionObserver` falls back to the document viewport. Out of scope for this fix.

## Acceptance Criteria

- [x] Back navigation (detail → list) preserves search query, filter state, sort order, pagination depth, and selection
- [x] Scroll position is correctly restored on back navigation (existing `useProfileNavigationEffects` continues to work)
- [x] Forward navigation (list → detail) still works with smooth slide animation
- [x] Article detail page renders correctly despite being wrapped by ArticleWorkspaceProvider
- [x] Owner sees drafts + published; visitor sees published only (filtering now in layout)
- [x] `page.tsx` is no longer async and makes no server-side auth call
- [x] `pnpm --filter @feel-good/mirror lint` passes
- [x] `pnpm --filter @feel-good/mirror exec tsc --noEmit` passes

## Files Changed

| File | Change |
|------|--------|
| `apps/mirror/app/[username]/layout.tsx` | Add articles computation, pass `articles` prop to ProfileShell |
| `apps/mirror/app/[username]/_components/profile-shell.tsx` | Add `articles` prop, wrap children in `ArticleWorkspaceProvider` |
| `apps/mirror/app/[username]/page.tsx` | Remove provider wrapper, remove async/params/auth, simplify to toolbar + list |

## Files Unchanged (Verify)

| File | Why unchanged |
|------|---------------|
| `apps/mirror/app/[username]/[slug]/page.tsx` | Detail page — no provider usage, wrapped harmlessly |
| `apps/mirror/features/articles/context/article-workspace-context.tsx` | Provider internals unchanged |
| `apps/mirror/features/articles/components/scrollable-article-list.tsx` | Context consumer — reads same contexts |
| `apps/mirror/features/articles/components/article-toolbar-view.tsx` | Context consumer — reads same contexts |
| `apps/mirror/hooks/use-profile-navigation-effects.ts` | Scroll memory — operates on container refs, unaffected |

## References

- Brainstorm: `docs/brainstorms/2026-02-15-article-list-back-nav-perf-brainstorm.md`
- Issue ticket: `todos/207-pending-p2-article-list-remount-on-back-navigation.md`
- Provider separation pattern: `docs/solutions/architecture-patterns/provider-separation-of-concerns.md`
- View transition timing: `todos/completed/122-completed-p1-view-transition-timing-race.md`
- Context splitting decision: `todos/completed/181-completed-p3-consider-context-splitting.md`
