---
id: FG_150
title: "Cover image is reachable by the clone agent (or documented as decorative)"
date: 2026-05-05
type: improvement
status: to-do
priority: p3
description: "The new cover-image surface has zero agent visibility — no alt/caption field reaches the embeddings pipeline. Either expose it or document covers as intentionally decorative."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Either: (a) An optional `coverAlt` (or `coverCaption`) field exists on the articles schema, is editable from the cover picker, and is appended to the body string in `getContentForEmbedding` before `extractPlainText`; OR (b) a comment in `articles/schema.ts` and a note in the agent-native rules explicitly classify covers as decorative."
  - "If option (a): a unit test asserts that an article with a `coverAlt` produces an embedding chunk containing the alt text."
  - "`pnpm build --filter=@feel-good/mirror` passes."
owner_agent: "convex backend engineer (RAG)"
---

# Cover image is reachable by the clone agent (or documented as decorative)

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; agent-native reviewer). The new editor adds `coverImageStorageId` to articles. There is no `coverAlt`/`coverCaption` field, and `packages/convex/convex/embeddings/queries.ts:79-93`'s `getContentForEmbedding` for articles returns only `title`, `body`, `slug`, `userId`, `status`. The cover storage ID is invisible to `extractPlainText`.

Mirror's parity invariant: every user-authored content surface should be reachable by the clone agent. Cover images are a new user-authored surface with zero agent visibility.

**Risk (low):** the clone cannot describe or speak from cover images. Severity is P3 because covers are usually decorative; the most important article content lives in title and body. But this is the kind of latent gap that becomes painful when image-heavy articles ship.

## Goal

Either the cover image's textual context (alt or caption) reaches the embeddings pipeline, or the project explicitly classifies covers as decorative and out of scope.

## Scope

- Decide between option (a) add `coverAlt`/`coverCaption` field, or (b) document as decorative.
- Implement the decision.

## Out of Scope

- OCR of cover images (out of scope).
- Inline image alt text — covered by FG_142.

## Approach

Recommend option (a) for parity completeness. The schema field is `v.optional(v.string())`; the cover picker UI gains a small text input; `getContentForEmbedding` appends the alt to the body string before extraction.

- **Effort:** Medium (option a) / Small (option b)
- **Risk:** Low

## Implementation Steps

1. Decide a vs b.
2. **Option a**:
   - Add `coverAlt: v.optional(v.string())` to the articles schema.
   - Plumb it through `create`/`update` validators.
   - Add an alt-text input to the cover picker UI.
   - In `getContentForEmbedding`, prepend `coverAlt + "\n"` to the body string before `extractPlainText`.
   - Add a unit test.
3. **Option b**:
   - Add a comment in `articles/schema.ts` explicitly excluding covers from agent context.
   - Note the decision in `.claude/rules/embeddings.md`.

## Constraints

- Option a's schema change must remain backwards-compatible (optional field).
- Option b is a documentation-only change; do not introduce a "cover-decorative" abstraction.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- `.claude/rules/embeddings.md`
