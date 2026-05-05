---
id: FG_142
title: "Inline image alt text reaches the article embeddings pipeline"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "Tiptap image nodes carry descriptive intent in attrs.alt, but extractPlainText returns an empty string for them, silently dropping image descriptions from the clone agent's RAG context."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`packages/convex/convex/embeddings/textExtractor.ts` has a branch for `node.type === 'image'` that returns `node.attrs?.alt` (and optionally `attrs?.title`)."
  - "A unit test in the embeddings test suite asserts that an article body with `{type:'image', attrs:{alt:'A graph showing X'}}` produces a chunk containing the alt text."
  - "`pnpm --filter=@feel-good/convex exec tsc --noEmit` passes."
owner_agent: "convex backend engineer (RAG)"
---

# Inline image alt text reaches the article embeddings pipeline

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; agent-native reviewer). The new article editor adds inline images via the slash command and toolbar, inserting Tiptap Image nodes shaped like `{type: "image", attrs: {src, alt, storageId}}`. Image is a leaf node — no `content[]`, no `text` field — so `packages/convex/convex/embeddings/textExtractor.ts:13-41` returns `""` for it. Any `alt` text the user writes is silently dropped from `contentEmbeddings`.

Mirror's parity invariant (per `.claude/rules/embeddings.md`): every user-authored content surface must reach the embeddings pipeline so the clone can speak from it. Image alt text is content the user typed, with semantic intent (e.g., "A graph showing revenue growth 2020-2024") — the clone is currently blind to it.

**Risk:** image-heavy articles produce thin or empty embedding chunks; the clone agent cannot describe or reference image content the user explicitly captioned.

## Goal

Image `alt` text (and optionally `title`) is included in the text emitted by `extractPlainText`, reaching the embeddings pipeline alongside body prose.

## Scope

- Add an image branch in `extractPlainText`.
- Add a regression test.

## Out of Scope

- Cover image alt text — covered by FG_150 (separate surface; cover image has no alt field yet).
- Refactoring the extractor for non-image leaf nodes.

## Approach

Add one branch:
```ts
if (node.type === "image") {
  const alt = node.attrs?.alt ?? "";
  const title = node.attrs?.title ?? "";
  return [alt, title].filter(Boolean).join(" ");
}
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Edit `packages/convex/convex/embeddings/textExtractor.ts:13-41`: add an early return for `node.type === "image"` that emits `attrs.alt` (and `attrs.title`) joined by a space.
2. Add a Vitest test under the existing embeddings test suite that constructs a synthetic body with an image node and asserts the extracted text contains the alt string.
3. Verify no regression for prose-only bodies.

## Constraints

- Must not break the existing block-node handling (paragraph, heading, list, blockquote, codeBlock, horizontalRule).
- Must not introduce `undefined` strings (filter empty fields).

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- `.claude/rules/embeddings.md`
