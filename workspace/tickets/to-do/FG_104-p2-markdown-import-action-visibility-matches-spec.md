---
id: FG_104
title: "Markdown-import action visibility matches spec FR-12 (internalAction or documented public)"
date: 2026-05-02
type: refactor
status: to-do
priority: p2
description: "Spec FR-12 says 'the markdown-import action and cron sweep run as internalAction / internalMutation and are not exposed to the public API.' Implementation registers importArticleMarkdownInlineImages and importPostMarkdownInlineImages in inlineImages.ts as public action() (with manual auth + ownership checks). Either revise the implementation to internalAction (with a separate thin public wrapper if the client needs it), or update the spec to document the public-action pattern explicitly. Today's gap is silent — a future reviewer will hit the same finding."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "Either: public action() registrations in inlineImages.ts move to internalAction() and a thin public wrapper (or HTTP route) exposes the right surface; OR spec FR-12 is updated to acknowledge the public-action pattern with manual auth check"
  - "If code is changed: grep -n 'export const importArticleMarkdownInlineImages = action' returns 0 matches, replaced by internalAction or a wrapper around it"
  - "If spec is updated: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md FR-12 mentions the public-action wrapper and the in-handler getAuthUser/ownership-check pattern"
  - "internal action (importMarkdownInlineImages in actions.ts) gains a defense-in-depth ownership re-check OR an explicit comment that it must only be called via the public wrapper"
  - "Existing tests still pass: pnpm --filter=@feel-good/convex test"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Convex API contract / spec custodian"
---

# Markdown-import action visibility matches spec FR-12 (internalAction or documented public)

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #18, security and api-contract reviewers at confidence 0.65–0.68.

Spec FR-12 reads (`workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md`):

> The markdown-import action and cron sweep run as `internalAction` / `internalMutation` and are not exposed to the public API.

Implementation: `packages/convex/convex/articles/inlineImages.ts:67` registers `importArticleMarkdownInlineImages` as public `action({ ... })`. Same for posts at `inlineImages.ts:72`. The handler does manually call `authComponent.getAuthUser(ctx)` and check ownership via `_getArticleOwnership` internal query — but the function is public-callable, contradicting the spec's literal language.

The internal action `importMarkdownInlineImages` in `actions.ts` has no ownership re-check. If a future caller bypasses the public wrapper (e.g., another internal action that calls `internal.articles.actions.importMarkdownInlineImages` directly), the ownership boundary disappears.

Two valid paths:

- **Make implementation match spec:** `inlineImages.ts` exports become `internalAction`, and the only public surface is something else (e.g., an HTTP route, or the markdown-upload-dialog calls it indirectly via `use-create-post-from-file.ts` through a different public mutation that schedules the internal action via `ctx.scheduler.runAfter`).
- **Make spec match implementation:** Update FR-12 to describe the public-wrapper-with-manual-auth pattern as the chosen design, and add a defense-in-depth note for the internal action.

The public-wrapper pattern is widespread in the codebase (e.g., `articles.mutations.update` is `authMutation` which is a wrapper) — making the spec catch up is the cheaper, less-invasive choice, but the internal action still needs its DIDD comment.

## Goal

After this ticket, the spec language and the implementation agree on whether markdown-import is callable from public clients. The internal action `importMarkdownInlineImages` either has an in-handler ownership check, or has a load-bearing comment naming the public wrapper as its only legitimate caller.

## Scope

- Pick a path (spec-update vs. code-restructure).
- Update either the spec or the function-registration.
- Add a defense-in-depth comment or check to `internal.{articles,posts}.actions.importMarkdownInlineImages`.

## Out of Scope

- Cross-user storage deletion fix (FG_091 territory).
- Refactoring auth-flow primitives (`authComponent.getAuthUser`).
- Migrating other `action` registrations to `internalAction`.

## Approach

**Spec-update path (recommended, smaller blast radius):**

1. Edit FR-12 to read: "The internal markdown-import action (`internal.{articles,posts}.actions.importMarkdownInlineImages`) is wrapped by a public action `import{Article,Post}MarkdownInlineImages` in `inlineImages.ts` that performs explicit auth + ownership checks before delegating. The internal action is only safe to call from this wrapper; direct callers must verify ownership themselves."
2. Add a comment in `articles/actions.ts` and `posts/actions.ts` `importMarkdownInlineImages` handler: "// PRECONDITION: caller has verified ownership of args.{articleId,postId}. The public wrapper in {articles,posts}/inlineImages.ts is the only safe entrypoint."
3. Optional: add an `ownerId: v.id("users")` arg the internal action can re-verify against, closing the DIDD gap structurally.

**Code-restructure path:**

1. Move public wrappers to `inlineImages.ts` keep them, but make them `internalAction` and expose a different public surface (HTTP route or scheduler-dispatched mutation).
2. Update the markdown-upload-dialog connector / `use-create-post-from-file.ts` to use the new public surface.
3. Test the full flow.

- **Effort:** Small (spec path) | Medium (code path)
- **Risk:** Low (spec path) | Medium (code path — touches client wiring)

## Implementation Steps

**Spec-update path:**

1. Edit FR-12 in the spec as described.
2. Add the precondition comment to both internal actions.
3. (Optional, recommended) Add `ownerId: v.id("users")` arg to internal actions and verify against the entity's userId before proceeding.
4. Run `pnpm --filter=@feel-good/convex test`.
5. Run `pnpm --filter=@feel-good/mirror build`.

## Constraints

- The client-facing API (`internal.articles.actions.importMarkdownInlineImages` callable from `inlineImages.ts`) must remain functional.
- Existing tests must pass; if the optional arg is added, tests must pass it.
- Spec changes should be diff-clean in markdown.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #18.
- `packages/convex/convex/articles/inlineImages.ts:67-104` and `posts/inlineImages.ts:72-107`.
- Spec `workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md` FR-12.
