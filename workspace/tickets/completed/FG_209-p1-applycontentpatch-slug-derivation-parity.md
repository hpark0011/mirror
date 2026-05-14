---
id: FG_209
title: "applyContentPatch returns the slug actually persisted by writeHelpers"
date: 2026-05-14
type: fix
status: completed
priority: p1
description: "`applyContentPatch` re-derives the post/article slug client-side via `generateSlug(op.slug?.trim() ? op.slug : op.title)` after the writeHelper has already inserted the row. For posts the writeHelper trims the title before slugifying; the re-derivation passes raw `op.title`. Today this is rescued only by `generateSlug`'s own strip step, so the bug is latent: any future change to `generateSlug`'s whitespace handling silently routes the owner to a 404 editor URL after creating content."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "`createPostForUser` and `createArticleForUser` return `{ id, slug }` (current return: bare `Id<>`)."
  - "`applyContentPatch` consumes the returned slug instead of recomputing — `grep -c 'generateSlug(op.slug' packages/convex/convex/chat/toolMutations.ts` returns 0."
  - "A new test asserts that creating a post with `op.title === '  Hello World  '` returns `lastTouched.slug` equal to the DB row's `slug` field."
  - "Existing tests `creates a draft post with normalized slug` and `creates a draft article via the same operation shape` still pass."
  - "`pnpm --filter=@feel-good/convex check-types` exits 0 — public auth mutation call sites adapt to the new return shape (only the `id` is consumed there today)."
owner_agent: "Convex write helpers + chat tools fixer"
---

# applyContentPatch returns the slug actually persisted by writeHelpers

## Context

Found in code review of branch `hpark0011/explain-profile-config-agent`. Five reviewers (correctness, convention, concurrency, maintainability, data-integrity) all flagged the same fingerprint — concurrency rated it P1 because the diverging slug source can return a `lastTouched.href` / `editHref` pointing to a URL the watcher then 404s on. Today the bug is rescued only by `generateSlug` performing its own whitespace strip; the comment at `packages/convex/convex/chat/toolMutations.ts:640-642` claims "exact same source" which is false for the posts path (writeHelper trims; caller doesn't). `.claude/rules/identifiers.md` rule 1 forbids parallel sanitizers — the re-derivation IS a parallel sanitizer.

## Goal

The slug embedded in `applyContentPatch`'s result (`results[].slug`, `lastTouched.slug`, `href`, `editHref`) is the exact slug persisted in the DB row, sourced from a single normalization at the writeHelper boundary.

## Scope

- Change `createPostForUser` (packages/convex/convex/posts/writeHelpers.ts) to return `{ id: Id<"posts">, slug: string }`.
- Change `createArticleForUser` (packages/convex/convex/articles/writeHelpers.ts) to return `{ id: Id<"articles">, slug: string }`.
- Update `applyContentPatch` create branch (packages/convex/convex/chat/toolMutations.ts) to consume the returned slug — delete the `generateSlug(op.slug?.trim() ? op.slug : op.title)` re-derivation.
- Update the public `articles.create` and `posts.create` auth mutations to extract `id` from the new return shape (they only return `id` to the client).
- Update the slug-related comment block.

## Out of Scope

- Changing slug normalization behavior in `content/slug.ts`.
- Refactoring update/delete return shapes (they already return `{ id, slug, status }`).

## Approach

Single-source the persisted slug at the writeHelper boundary; remove the parallel `generateSlug` call in `applyContentPatch`. The `id` consumers in `articles/mutations.ts` and `posts/mutations.ts` change one line each.

- **Effort:** Small
- **Risk:** Low — return-shape widening, type-checked.

## Implementation Steps

1. Edit `packages/convex/convex/posts/writeHelpers.ts:76-174` (`createPostForUser`): change return type to `Promise<{ id: Id<"posts">; slug: string }>` and return `{ id: postId, slug }`.
2. Edit `packages/convex/convex/articles/writeHelpers.ts:76-183` (`createArticleForUser`): same change for `Id<"articles">`.
3. Edit `packages/convex/convex/articles/mutations.ts` and `posts/mutations.ts` public `create` handlers: change `return await createArticleForUser(...)` to `return (await createArticleForUser(...)).id` (the public mutation's `returns: v.id("articles")` is unchanged).
4. Edit `packages/convex/convex/chat/toolMutations.ts:615-665` create branch: replace the post-call slug re-derivation with destructuring of the helper return; delete the `slug = generateSlug(...)` line and the surrounding comment block.
5. Add a test in `packages/convex/convex/chat/__tests__/tools.test.ts` (`applyContentPatch` describe): create a post with whitespace-padded title (`"  Hello World  "`), assert `result.lastTouched.slug === "hello-world"` AND assert the DB row's slug field matches.
6. Run `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/convex check-types`.

## Constraints

- Public auth mutation return type stays `v.id("posts")` / `v.id("articles")` — only the helper's TypeScript return shape widens.
- Do not introduce a separate `generateSlug` call anywhere in `chat/toolMutations.ts`.

## Resources

- `.claude/rules/identifiers.md` § "One canonical normalizer per identifier kind."
- Code review finding, P1 (concurrency lane).
