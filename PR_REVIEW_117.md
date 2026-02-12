# PR #117 Review: `feat(mirror): add publish state to articles`

**Commit:** `be57533` — 1 commit, 3 files changed (+39, -4)

## Summary

Adds a `status: "draft" | "published"` field to the `Article` type. Draft articles show "Draft" instead of the formatted publish date in the list view and detail view. 10 of 30 mock articles are marked as drafts.

## File-by-file review

### `apps/mirror/features/articles/lib/mock-articles.ts`

- Type addition is clean — `status: "draft" | "published"` is a good, narrow union type.
- All 30 mock articles get the new required field. No runtime breakage.

### `apps/mirror/features/articles/components/article-list-item.tsx`

- The conditional rendering is straightforward and correct: drafts show a `<span>`, published articles keep the `<time>` element.

### `apps/mirror/features/articles/views/article-detail-view.tsx`

- Inline ternary on line 17 is fine for a simple toggle.

## Issues

### 1. Draft articles still have `published_at` dates and sort by them

**File:** `apps/mirror/features/articles/hooks/use-article-list.ts:14-16`

The sort in `useArticleList` sorts all articles by `published_at`. Draft articles have `published_at` values even though they're unpublished. This means:
- A "draft" article sorts among published articles based on a `published_at` date that has no real meaning.
- Sorting by "newest"/"oldest" treats drafts identically to published articles.

Consider whether drafts should sort by `created_at` instead, or be separated into their own section. At minimum, the `published_at` field on drafts is semantically misleading — it could be made optional (`published_at?: string`) for drafts, which would also force all consumers to handle the `null` case safely.

### 2. No visual distinction for drafts in the detail view (minor)

In `article-detail-view.tsx:17`, the draft case renders the bare string `"Draft"` inside a `<span>` that previously held a formatted date. This is fine functionally, but the detail view doesn't visually distinguish drafts beyond replacing the date text. If draft articles should be visually distinct (e.g., a badge, a different color), this would be the place.

### 3. `published_at` is still accessible on draft articles

Not a bug since the ternary guards the `<time>` render, but if the type were ever relaxed to `published_at?: string`, the current code in `article-list-item.tsx:55` would pass `undefined` to `dateTime` and `formatShortDate`. Worth noting for future-proofing.

## Nits

- The string `"Draft"` appears as a magic string in two separate components (`article-list-item.tsx` and `article-detail-view.tsx`). Not worth extracting for just two usages, but noting it.

## Verdict

The change is small, correct, and non-breaking. The main concern is the **semantic mismatch of draft articles carrying `published_at` dates** — this should be addressed either now (by making `published_at` optional for drafts) or tracked as a follow-up to avoid confusing sort behavior and data semantics as the feature evolves.
