---
id: FG_095
title: "Markdown-import action body and walk helpers are sourced from a shared content/ module"
date: 2026-05-02
type: refactor
status: completed
priority: p1
description: "articles/actions.ts and posts/actions.ts contain near-identical importMarkdownInlineImages handlers (~70 lines each) plus identical walk / collectExternalImageSrcs / isAbsoluteHttpUrl helpers (~30 lines each). Diff after entity-name normalization shows only comment-text differences. Every future change to the import logic — partial-failure handling, bytes-magic check, deduplication, retry — must be applied twice. Extract the import body and the walk helpers into a single shared content/ module so the article and post actions become thin wrappers."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "grep -n 'isAbsoluteHttpUrl\\|collectExternalImageSrcs' packages/convex/convex/articles/actions.ts returns 0 matches (helpers no longer defined locally)"
  - "Same grep on packages/convex/convex/posts/actions.ts returns 0 matches"
  - "grep -n 'collectExternalImageSrcs\\|isAbsoluteHttpsUrl' packages/convex/convex/content/body-walk.ts (or new content/markdown-import.ts) returns at least 1 match"
  - "Both articles/actions.ts and posts/actions.ts importMarkdownInlineImages handlers are under 30 lines each (thin wrappers around the shared helper)"
  - "All inline-images.test.ts cases continue to pass: pnpm --filter=@feel-good/convex test"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Convex backend / refactor specialist"
---

# Markdown-import action body and walk helpers are sourced from a shared content/ module

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #6 (umbrella; this is the actions-side slice), maintainability reviewer at confidence 0.88. The duplication:

`packages/convex/convex/articles/actions.ts:131-160` defines `isAbsoluteHttpUrl`, `collectExternalImageSrcs`, and `walk`. `packages/convex/convex/posts/actions.ts:126-155` contains the byte-identical implementations. The header comment at `body-walk.ts:1-9` claims it's "the single source of truth for inline-image traversal across articles, posts, the cron sweep, and the markdown-import action" — but the markdown-import-side traversal helpers were never added there.

Beyond the helpers, the entire `importMarkdownInlineImages` handler body (lines 52-127 in articles, 52-122 in posts) is a near-textual copy: same fetch loop, same `tried`/`resolved` Map, same `mapInlineImages` rewrite, same result assembly. Only differences: which `_readBody` query is called and which `_patchInlineImageBody` mutation is dispatched.

Several follow-up tickets (FG_101 import cap, FG_110 magic-byte check, FG_111 http filter, FG_112 parallel fetch, FG_115 import count) all want changes inside this body. Without extraction they each become two-place edits that drift.

## Goal

After this ticket, the article and post markdown-import actions are <30-line wrappers that delegate the full `importMarkdownInlineImages` logic to a shared helper in `packages/convex/convex/content/`. A single edit to the import logic affects both surfaces.

## Scope

- Extract `isAbsoluteHttpUrl`, `collectExternalImageSrcs`, `walk` to `packages/convex/convex/content/body-walk.ts` (or a new `content/markdown-import.ts` if `body-walk.ts` is meant to stay pure).
- Extract the `importMarkdownInlineImages` action body to a shared async helper that takes `(ctx, body, runPatchMutation)` and returns the `ImportResult`.
- Both actions become thin wrappers wiring the entity-specific `_readBody` / `_patchInlineImageBody` callbacks.
- Update package.json `exports` and `typesVersions` for any new module.

## Out of Scope

- Touching the v8-runtime `internalImages.ts` files (those are entity-specific by Convex's file-per-namespace router constraint and are intentionally split).
- Resolving the spec FR-12 vs implementation gap on whether these are public `action` or `internalAction` (FG_104 territory).
- The cross-user storage deletion fix (FG_091) — different surface entirely.

## Approach

`body-walk.ts` is currently a "no Convex runtime imports" pure module. The walk helpers (`isAbsoluteHttpUrl`, `collectExternalImageSrcs`, `walk`) are pure too — they go in `body-walk.ts` cleanly.

The `importMarkdownInlineImages` body is NOT pure — it calls `safeFetchImage`, `ctx.storage.store`, `ctx.storage.getUrl`. It belongs in a `"use node"` file. Add `packages/convex/convex/content/markdown-import.ts` (or `.use-node.ts`-style naming) that exports `importMarkdownInlineImagesCore(ctx, body, patchFn) → Promise<ImportResult>`. Both action files call this with the entity-specific patch callback.

Note the Convex hyphenated-filename rule: `body-walk.ts` lives in `content/` because Convex's dotted `internal.*` router can't resolve hyphens. A new `markdown-import.ts` follows the same pattern as a pure module — no exported Convex functions, just helpers.

- **Effort:** Medium
- **Risk:** Medium — touches the import hot path; needs full test coverage to confirm no regression.

## Implementation Steps

1. Move `isAbsoluteHttpUrl`, `collectExternalImageSrcs`, and `walk` from both `articles/actions.ts` and `posts/actions.ts` into `packages/convex/convex/content/body-walk.ts`. Update the file header comment to reflect new exports.
2. Create `packages/convex/convex/content/markdown-import.ts` with `"use node"` and export `importMarkdownInlineImagesCore(ctx: ActionCtx, body: JSONContent | null, patchBody: (next: JSONContent) => Promise<void>) → Promise<ImportResult>`.
3. Update `packages/convex/package.json` `exports` and `typesVersions` for `convex/content/body-walk` (already there) and `convex/content/markdown-import` (new).
4. Replace `articles/actions.ts` `importMarkdownInlineImages` handler body with a call to the shared helper, passing the entity-specific patch callback. Verify the action's exported signature is unchanged.
5. Mirror in `posts/actions.ts`.
6. Run `pnpm --filter=@feel-good/convex test` — all 219 tests must continue passing, especially the FR-08 import scenarios.
7. Run `pnpm --filter=@feel-good/mirror build`.

## Constraints

- Public API surface (`internal.articles.actions.importMarkdownInlineImages`, `internal.posts.actions.importMarkdownInlineImages`) must NOT change — these are referenced by `inlineImages.ts` and the markdown-upload connector.
- The helper must be pure-Node-runtime — no V8-runtime imports.
- Existing test mocks of `safeFetchImage` must still work without modification.
- Constants (`MAX_INLINE_DELETES_PER_INVOCATION`) already centralized in `storage-policy.ts` (FG_019, applied) — follow the same pattern.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #6.
- `packages/convex/convex/articles/actions.ts:52-127` and `posts/actions.ts:52-122` — the duplicated handler bodies.
- `packages/convex/convex/content/body-walk.ts` — the existing canonical traversal module.
- `.claude/rules/file-organization.md` — module placement.
