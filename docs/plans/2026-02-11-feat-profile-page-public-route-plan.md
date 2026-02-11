---
title: "Move dashboard profile view to public /@username route"
type: feat
date: 2026-02-11
---

# Move Dashboard Profile View to Public `/@username` Route

## Overview

The current `/(protected)/dashboard` displays a user's profile and articles — essentially a public profile page. This needs to move to a public `/@[username]` route (like X/Instagram profiles), while the dashboard itself becomes a protected "Insights" page.

## Problem Statement

- Dashboard currently serves double duty: profile view + future insights
- Profile pages should be publicly accessible, not behind auth
- URL structure doesn't communicate "this is a profile" — `/dashboard` is ambiguous

## Technical Approach

### The `@` Routing Challenge

Next.js App Router reserves `@folder` for parallel routes (named slots). A folder named `@[username]` would break routing. Two options:

| Approach | Pros | Cons |
|----------|------|------|
| **Rewrites** — folder `[username]/`, rewrite `/@:username` → `/:username` | Clean folder structure, standard Next.js | Both `/@user` and `/user` resolve (need middleware guard) |
| **Catch-all** — folder `[...path]/`, parse `@` manually | Full control | More complex routing logic, harder to maintain |

**Chosen: Rewrites approach.** Cleanest solution. Middleware already exists and can guard against `/username` without `@`.

### Architecture

```
BEFORE:                              AFTER:
/(protected)/dashboard               /(protected)/dashboard
  ├── page.tsx (article list)           └── page.tsx ("Insights" placeholder)
  ├── layout.tsx (auth + shell)
  ├── _components/                   /[username]                    ← NEW (public)
  │   ├── dashboard-shell.tsx          ├── page.tsx (article list)
  │   └── dashboard-header.tsx         ├── layout.tsx (shell, NO auth)
  └── articles/[slug]/                 ├── _components/
      └── page.tsx                     │   ├── profile-shell.tsx   ← renamed
                                       │   └── profile-header.tsx  ← renamed
                                       └── [slug]/
                                           └── page.tsx (article detail)
```

### URL Mapping

| URL | Internal Route | Content |
|-----|---------------|---------|
| `/@rick-rubin` | `/rick-rubin` (via rewrite) | Profile + article list |
| `/@rick-rubin/the-art-of-listening` | `/rick-rubin/the-art-of-listening` (via rewrite) | Article detail |
| `/dashboard` | `/(protected)/dashboard` | "Insights" placeholder (auth required) |

## Acceptance Criteria

- [ ] `/@[username]` shows profile + article list (publicly accessible)
- [ ] `/@[username]/[slug]` shows article detail (publicly accessible)
- [ ] Styles and layout (desktop split panel, mobile drawer) preserved exactly
- [ ] View transitions (slide forward/back) work on profile routes
- [ ] `/dashboard` requires auth, shows "Insights" placeholder text
- [ ] No broken imports or dead code left behind
- [ ] All existing routes (`/`, `/sign-in`, `/sign-up`) still work
- [ ] CLAUDE.md updated with new routing structure

## Implementation Plan

### Phase 1: Profile Type + Mock Data Update

**`features/profile/lib/mock-profile.ts`**
- Add `username: string` field to `Profile` type
- Add `username: "rick-rubin"` to `MOCK_PROFILE`

### Phase 2: Create Public Profile Route

**`app/[username]/layout.tsx`** (new — server component)
- NO auth check (public route)
- Look up profile by `username` param (use `MOCK_PROFILE` for now)
- Return `notFound()` if username doesn't match
- Wrap children with `ProfileShell` (renamed from `DashboardShell`)

**`app/[username]/page.tsx`** (new — server component)
- Render `<ScrollableArticleList articles={MOCK_ARTICLES} />`
- Same as current dashboard page

**`app/[username]/[slug]/page.tsx`** (new — server component)
- Same logic as current `dashboard/articles/[slug]/page.tsx`
- Find article by slug, `notFound()` if missing, render `ArticleDetailView`

**`app/[username]/_components/profile-shell.tsx`** (new — moved + renamed)
- Copy from `dashboard-shell.tsx`
- Rename component to `ProfileShell`
- Accept `username` prop for link generation
- Update `ViewTransition` name from `"dashboard-content"` to `"profile-content"`

**`app/[username]/_components/profile-header.tsx`** (new — moved + renamed)
- Copy from `dashboard-header.tsx`
- Rename component to `ProfileHeader`
- Update back link: `href="/dashboard"` → `href={/@${username}}`
- Accept `username` prop

### Phase 3: Update Supporting Code

**`features/articles/components/article-list-item.tsx`**
- Change link: `/dashboard/articles/${article.slug}` → needs username context
- Add `username` prop to `ArticleListItem`
- New href: `/@${username}/${article.slug}`
- Propagate `username` prop through `ArticleListView` → `ArticleListItem`

**`hooks/use-nav-direction.ts`**
- Update `isArticleDetailRoute` to detect profile routes: path matches `/@username/slug` pattern
- Change from `path.startsWith("/dashboard/articles/")` to regex or pattern that handles `/@[username]/[slug]`

**`styles/globals.css`**
- Rename `view-transition-old/new(dashboard-content)` → `view-transition-old/new(profile-content)` if ViewTransition name changes (or keep `dashboard-content` name to minimize CSS changes)

### Phase 4: URL Rewrite Configuration

**`next.config.ts`**
- Add `rewrites()` to map `/@:username` → `/:username` and `/@:username/:slug` → `/:username/:slug`

### Phase 5: Middleware Updates

**`middleware.ts`**
- Add `/@*` paths to public routes (they should not require auth)
- Also allow `/[username]` paths (the rewrite targets) — but guard against ambiguity with other routes
- Keep protecting `/(protected)/*` routes

### Phase 6: Replace Dashboard Content

**`app/(protected)/dashboard/page.tsx`**
- Replace article list with "Insights" placeholder text
- Remove article-related imports

**`app/(protected)/dashboard/layout.tsx`**
- Keep auth check
- Remove `DashboardShell` and profile imports
- Simplify to just render children with basic layout

**Clean up:**
- Delete `app/(protected)/dashboard/_components/dashboard-shell.tsx`
- Delete `app/(protected)/dashboard/_components/dashboard-header.tsx`
- Delete `app/(protected)/dashboard/articles/` directory

### Phase 7: Update CLAUDE.md

**`apps/mirror/CLAUDE.md`**
- Update project structure section to reflect new routes
- Document `/@[username]` public profile routes
- Document rewrites configuration
- Update route table

## Key Decisions

1. **ViewTransition name:** Keep as `"dashboard-content"` to avoid touching CSS, or rename to `"profile-content"` for clarity. Recommend renaming for accuracy since it's no longer dashboard content.

2. **Username prop threading:** `ArticleListItem` needs to know the username for links. Pass via prop from layout → page → component chain. Context is overkill for a single string.

3. **Mock username validation:** For now, only `"rick-rubin"` is valid. The `[username]/layout.tsx` checks against `MOCK_PROFILE.username` and returns `notFound()` for others. This prevents the catch-all from swallowing routes like `/favicon.ico`.

4. **Route conflict prevention:** The `[username]` dynamic segment at root level could catch `/dashboard`, `/sign-in`, etc. Middleware handles this — authenticated routes redirect to `/(protected)/dashboard` before hitting `[username]`. For static public routes (`/`, `/sign-in`, `/sign-up`), they have explicit route folders that take priority over the dynamic `[username]` segment in Next.js.

## References

- Current dashboard shell: `apps/mirror/app/(protected)/dashboard/_components/dashboard-shell.tsx`
- Current article links: `apps/mirror/features/articles/components/article-list-item.tsx:8`
- Nav direction hook: `apps/mirror/hooks/use-nav-direction.ts:7`
- View transition CSS: `apps/mirror/styles/globals.css:39-55`
- Middleware: `apps/mirror/middleware.ts`
- Next.js config: `apps/mirror/next.config.ts`
- Profile feature: `apps/mirror/features/profile/`
- Folder structure convention: `.claude/rules/folder-structure.md`
