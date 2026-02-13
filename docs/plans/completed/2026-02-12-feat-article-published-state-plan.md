---
title: Add publish state to articles
type: feat
date: 2026-02-12
---

# Add publish state to articles

## Overview

Add a `status` field to articles so each article can be either `draft` or `published`. Draft articles show "Draft" in the published column instead of the formatted date.

## Proposed Solution

Add a `status: "draft" | "published"` field to the `Article` type. Keep `published_at` on all articles (drafts retain it for sort ordering). Conditionally render "Draft" text in the published column based on status.

## Files to Change

### 1. `features/articles/lib/mock-articles.ts`

**Type change:** Add `status` field to `Article`.

```typescript
export type Article = {
  slug: string;
  title: string;
  cover_image: string;
  created_at: string;
  published_at: string;
  status: "draft" | "published";
  category: string;
  body: string;
};
```

**Mock data:** Add `status: "published"` to all 33 articles, then change ~10 evenly distributed articles to `status: "draft"`. Suggested draft articles (every 3rd, starting from index 1):

- Index 1: "Why Constraints Fuel Creativity"
- Index 4: "On Taste and Its Development"
- Index 7: "Beginner Mind in the Studio"
- Index 10: "Genre Is a Prison"
- Index 13: "Nature as Teacher"
- Index 16: "The Role of Accidents"
- Index 19: "The Myth of Writer's Block"
- Index 22: "The Power of Environment"
- Index 25: "Gratitude as Creative Fuel"
- Index 28: "When to Break the Rules"

### 2. `features/articles/components/article-list-item.tsx`

**Published column (line 54-58):** Conditional render based on `article.status`.

```tsx
<TableCell className="text-right py-0 font-medium rounded-r-md">
  {article.status === "draft" ? (
    <span className="text-muted-foreground">Draft</span>
  ) : (
    <time dateTime={article.published_at}>
      {formatShortDate(article.published_at)}
    </time>
  )}
</TableCell>
```

### 3. `features/articles/views/article-detail-view.tsx`

**Date display (line 16-18):** Show "Draft" instead of the formatted date for draft articles.

```tsx
<span className="text-[15px] text-muted-foreground leading-[1.2]">
  {article.status === "draft" ? "Draft" : formatLongDate(article.published_at)}
</span>
```

## What Does NOT Change

- `Article` type export in `index.ts` — already re-exports from `mock-articles.ts`
- `useArticleList` hook — sort by `published_at` still works (all articles keep dates)
- `useArticleSort` hook — no changes needed
- `useArticleSelection` hook — no changes needed
- `article-list-view.tsx` — column header "Published" remains as-is
- `format-date.ts` — no changes needed

## Acceptance Criteria

- [ ] `Article` type has `status: "draft" | "published"` field
- [ ] All 33 mock articles have a `status` field
- [ ] Exactly 10 articles have `status: "draft"`
- [ ] Draft articles show "Draft" text in the list view published column
- [ ] Published articles still show formatted date in the list view
- [ ] Draft articles show "Draft" in the detail view date area
- [ ] Published articles still show formatted date in the detail view
- [ ] `pnpm build --filter=@feel-good/mirror` passes
- [ ] `pnpm lint --filter=@feel-good/mirror` passes
