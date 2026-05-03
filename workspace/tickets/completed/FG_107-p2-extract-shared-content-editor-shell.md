---
id: FG_107
title: "ArticleEditor and PostEditor share a single content-editor shell component"
date: 2026-05-02
type: refactor
status: completed
priority: p2
description: "ArticleEditor (97 lines) and PostEditor (95 lines) are structurally identical: same body state shape, same handleSave pattern, same toast error UI, same RichTextEditor wiring. The only differences are the prop entity type, the mutation called, and the upload hook. Both components are at the project's soft 100-line ceiling. Extract a generic content-editor shell so each domain editor becomes a thin adapter."
dependencies: [FG_092]
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "A shared component (e.g., apps/mirror/features/content/components/content-editor.tsx) holds the shared form state, save flow, error toast, and RichTextEditor mounting"
  - "ArticleEditor and PostEditor are each <40 lines, configuring the shared component with entity-specific mutation and upload hooks"
  - "Existing E2E specs (size-limit, mime-limit) and any newly un-fixme'd specs (FG_094) continue to pass"
  - "pnpm --filter=@feel-good/mirror build passes"
  - "Manual: edit pages for both articles and posts behave identically before and after"
owner_agent: "Mirror app refactor specialist"
---

# ArticleEditor and PostEditor share a single content-editor shell component

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding from maintainability reviewer (umbrella #6, included as a P2 in synthesis at confidence 0.82).

`apps/mirror/features/articles/components/article-editor.tsx` (97 lines) and `apps/mirror/features/posts/components/post-editor.tsx` (95 lines) differ in:

- The prop type (`ArticleWithBody` vs `PostSummary`).
- The `useMutation` target (`api.articles.mutations.update` vs `api.posts.mutations.update`).
- The upload hook (`useArticleInlineImageUpload` vs `usePostInlineImageUpload`).

Everything else — the body state, dirty-tracking, save handler, save-button disabled state (extended by FG_092), error toast, RichTextEditor mount + className — is byte-identical.

`.claude/rules/react-components.md` says components should be under ~100 lines. Both are at the ceiling. Adding the FG_092 pending-uploads gate to both pushes them over.

## Goal

After this ticket, the article and post edit-page client components are thin adapters that supply entity-specific data and side-effect callbacks to a single shared `ContentEditor` component. Adding a UX feature to the editor shell (e.g., autosave, dirty-tracking improvements, accessibility tweaks) is a one-place edit.

## Scope

- New file: `apps/mirror/features/content/components/content-editor.tsx` (or `packages/features/editor/components/` if cross-app sharing is desired).
- The shared component takes `initialBody`, `onSave: (body) => Promise<void>`, `onImageUpload`, `onPendingUploadsChange`, `cancelHref`, `className`.
- `ArticleEditor` and `PostEditor` become thin wrappers wiring entity-specific mutations and upload hooks.

## Out of Scope

- Server-side data fetching — stays in each entity's edit page route.
- Toolbar / formatting button changes — same as today.
- Cover-image editing in the same surface (explicitly out of scope per spec).
- The upload-hook validation extraction (FG_106 territory).

## Approach

Define the props interface around what differs:

```ts
type ContentEditorProps = {
  initialBody: JSONContent;
  onSave: (body: JSONContent) => Promise<void>;
  onImageUpload: (file: File) => Promise<InlineImageUploadResult>;
  cancelHref: string;
  saveLabel?: string;
};
```

The component owns: body state, dirty-tracking, isSaving state, pending-uploads gate (FG_092), error toast, save/cancel buttons, RichTextEditor mounting.

Article and post editors:

```ts
// article-editor.tsx (after refactor)
export function ArticleEditor({ article }: { article: ArticleWithBody }) {
  const updateArticle = useMutation(api.articles.mutations.update);
  const upload = useArticleInlineImageUpload();
  return (
    <ContentEditor
      initialBody={article.body}
      onSave={(body) => updateArticle({ id: article._id, body })}
      onImageUpload={upload}
      cancelHref={`/${article.username}/articles/${article.slug}`}
      saveLabel="Save article"
    />
  );
}
```

Recommend placing the shared component in `apps/mirror/features/content/components/` since `apps/mirror/features/content/` already exists for shared chrome. Cross-app sharing via `packages/features/editor/` is unnecessary today.

- **Effort:** Medium
- **Risk:** Medium — touches the primary write surface for both articles and posts; needs careful test coverage.

## Implementation Steps

1. Create `apps/mirror/features/content/components/content-editor.tsx` extracting the shared shell (state, save flow, toast, RichTextEditor wiring, save-pending-uploads gate from FG_092).
2. Update `apps/mirror/features/articles/components/article-editor.tsx` to wrap `ContentEditor` with article-specific wiring.
3. Update `apps/mirror/features/posts/components/post-editor.tsx` likewise.
4. Verify both edit pages render correctly via `pnpm --filter=@feel-good/mirror dev` and manual browser check.
5. Run all E2E specs (after FG_094 unblocks them): `pnpm --filter=@feel-good/mirror test:e2e`.
6. Run `pnpm --filter=@feel-good/mirror build`.

## Constraints

- The save button's disabled state must include both `isSaving` and `pendingUploads` (depends on FG_092 landing first).
- Error toast UX must match today's behavior.
- No regression on auth-gated edit-page rendering — the server component auth check stays.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` umbrella Finding #6.
- `apps/mirror/features/articles/components/article-editor.tsx` and `apps/mirror/features/posts/components/post-editor.tsx`.
- `.claude/rules/react-components.md` — ~100-line guideline.
- `.claude/rules/file-organization.md` — components live in `components/`, not `views/`.
