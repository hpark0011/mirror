---
id: FG_105
title: "RichTextEditor accepts an extensions prop instead of hardcoding article extensions"
date: 2026-05-02
type: refactor
status: to-do
priority: p2
description: "RichTextEditor in packages/features/editor/components/rich-text-editor.tsx hardcodes createArticleExtensions() at line 38, but the same component serves both article and post editors. PostEditor today is silently running articles' extension set. If posts ever need a different set (e.g., narrower toolbar, no headings, different code-block rules), the only path is forking the component. Accept extensions as a prop with a sensible default."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "RichTextEditor's prop type includes `extensions?: () => Extensions` (or equivalent)"
  - "When extensions prop is omitted, the default behavior matches today (createArticleExtensions())"
  - "Both ArticleEditor and PostEditor pass an explicit extensions function (or omit and rely on the default if articles)"
  - "Existing inline-image upload + sanitizer tests continue to pass"
  - "pnpm --filter=@feel-good/features test passes"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Editor / refactor specialist"
---

# RichTextEditor accepts an extensions prop instead of hardcoding article extensions

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #21, maintainability reviewer at confidence 0.78.

`packages/features/editor/components/rich-text-editor.tsx:36-45`:

```ts
const extensions = useMemo<Extensions>(
  () => [
    ...createArticleExtensions(),                                  // <-- hardcoded
    createInlineImageUploadExtension({
      onUpload: (file) => onImageUploadRef.current(file),
    }),
  ],
  [],
);
```

`PostEditor` imports this component verbatim. Posts run articles' extension set today by accident — it happens to be fine because `createArticleExtensions` is general-purpose, but the function name implies article-specificity and any divergence requires a fork.

`extensions.ts` already exports `createArticleExtensions` and `createMarkdownExtensions`, so the factory pattern exists.

## Goal

After this ticket, callers of `RichTextEditor` choose the extension set explicitly (or rely on a documented default). Diverging article and post extension needs are a one-line caller change, not a component fork.

## Scope

- `packages/features/editor/components/rich-text-editor.tsx` — accept `extensions?: () => Extensions` prop.
- `packages/features/editor/lib/extensions.ts` — possibly rename `createArticleExtensions` to `createDefaultRichTextExtensions` (deferred — bigger blast radius).
- `apps/mirror/features/articles/components/article-editor.tsx` and `post-editor.tsx` — pass the explicit factory.

## Out of Scope

- Differentiating article vs. post extension sets — this ticket just plumbs the prop. Actual divergence (if any) is a follow-up.
- Renaming `createArticleExtensions` (would touch many files; out of scope unless cheap).
- The shared editor shell extraction (FG_107 territory).

## Approach

```ts
type RichTextEditorProps = {
  content: JSONContent;
  onChange: (next: JSONContent) => void;
  onImageUpload: (file: File) => Promise<InlineImageUploadResult>;
  className?: string;
  extensions?: () => Extensions;
};

export function RichTextEditor({
  content,
  onChange,
  onImageUpload,
  className,
  extensions: extensionsFactory = createArticleExtensions,
}: RichTextEditorProps) {
  // ... existing onImageUploadRef and onChangeRef setup ...
  const extensions = useMemo<Extensions>(
    () => [
      ...extensionsFactory(),
      createInlineImageUploadExtension({
        onUpload: (file) => onImageUploadRef.current(file),
      }),
    ],
    [],
  );
  // ...
}
```

Callers in `article-editor.tsx` and `post-editor.tsx` can omit (relying on the default) or pass `extensions={createArticleExtensions}` explicitly. Recommend the explicit form so future readers don't wonder where the extensions come from.

- **Effort:** Small
- **Risk:** Low — backwards-compatible (default preserves current behavior).

## Implementation Steps

1. Add `extensions?: () => Extensions` to `RichTextEditorProps` in `rich-text-editor.tsx`.
2. Default to `createArticleExtensions` when prop is omitted.
3. Spread `extensionsFactory()` instead of `createArticleExtensions()` in the `useMemo`.
4. Update `apps/mirror/features/articles/components/article-editor.tsx` to pass `extensions={createArticleExtensions}` explicitly.
5. Update `apps/mirror/features/posts/components/post-editor.tsx` likewise.
6. Run `pnpm --filter=@feel-good/features test` and `pnpm --filter=@feel-good/mirror build`.

## Constraints

- Default behavior must preserve current behavior exactly — no surface changes to consumers that rely on it implicitly.
- The factory must remain a function (not pre-computed array) so per-instance configuration like inline-image-upload retains its closure over `onImageUploadRef`.
- The dependency array `[]` on the useMemo stays — the factory is called once at mount.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #21.
- `packages/features/editor/components/rich-text-editor.tsx:36-45` — the hardcoded site.
- `packages/features/editor/lib/extensions.ts` — the factory module.
