---
status: completed
priority: p2
issue_id: "132"
tags: [code-review, typescript, dead-code, mirror, pr-114]
dependencies: []
---

# Dead Fallback Link to Deleted `/dashboard/articles/` Route

## Problem Statement

`ArticleListItem` has an optional `username?: string` prop with a fallback link to `/dashboard/articles/${article.slug}`. This route was **deleted in PR #114** (file renamed from `app/(protected)/dashboard/articles/[slug]/page.tsx` to `app/[username]/[slug]/page.tsx`). The fallback produces a 404. The only consumer (`ProfilePage`) always provides `username`, making the optional typing and dead fallback unnecessary.

## Findings

- **Source:** TypeScript reviewer, pattern-recognition-specialist, code-simplicity-reviewer
- **Location:** `apps/mirror/features/articles/components/article-list-item.tsx` line 13
- **Evidence:** `const href = username ? \`/@\${username}/\${article.slug}\` : \`/dashboard/articles/\${article.slug}\`;` — the else branch links to a route that no longer exists. Grep confirms no caller omits `username`.

## Proposed Solutions

### Option A: Make `username` required across the chain (Recommended)

Change `username` from optional to required in `ArticleListItemProps`, `ArticleListViewProps`, and `ScrollableArticleListProps`. Remove the dead fallback ternary.

```diff
 // article-list-item.tsx
 type ArticleListItemProps = {
   article: Article;
-  username?: string;
+  username: string;
 };

-const href = username ? `/@${username}/${article.slug}` : `/dashboard/articles/${article.slug}`;
+const href = `/@${username}/${article.slug}`;
```

```diff
 // scrollable-article-list.tsx
 type ScrollableArticleListProps = {
   articles: Article[];
-  username?: string;
+  username: string;
 };
```

```diff
 // article-list-view.tsx
 type ArticleListViewProps = {
   ...
-  username?: string;
+  username: string;
 };
```

- **Effort:** Small
- **Risk:** None — compile-time error if any caller omits `username`, which is the desired behavior

## Recommended Action

Option A — eliminates dead code and turns a runtime 404 into a compile-time error.

## Technical Details

- **Affected files:**
  - `apps/mirror/features/articles/components/article-list-item.tsx`
  - `apps/mirror/features/articles/components/scrollable-article-list.tsx`
  - `apps/mirror/features/articles/views/article-list-view.tsx`

## Acceptance Criteria

- [ ] `username` is required (not optional) in all three component prop types
- [ ] Dead `/dashboard/articles/` fallback link is removed
- [ ] No `?` optional marker on `username` in the article component chain
- [ ] App builds with no type errors
- [ ] Article links navigate correctly to `/@username/slug`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-11 | Created from PR #114 code review | Remove dead code paths when routes are deleted |

## Resources

- PR: #114 — feat(mirror): move profile view to public /@username route
