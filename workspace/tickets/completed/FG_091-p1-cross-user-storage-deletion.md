---
id: FG_091
title: "Update mutation refuses to delete inline storage IDs the caller didn't introduce"
date: 2026-05-02
type: fix
status: completed
priority: p1
description: "Any authenticated user can permanently delete another user's storage blob by reading a public article's body, embedding the victim's storageId into their own article body, and removing it in a follow-up update. The articles/posts update mutations call ctx.storage.delete on every storageId in the multiset diff with no proof that the caller ever uploaded those blobs. Convex storage deletes are irreversible — this is a real cross-user trust-boundary violation surfaced in the inline-image-lifecycle review."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "grep -n 'inlineImageOwnership' packages/convex/convex/schema.ts (or equivalent join-table / introduced-set guard) returns at least 1 match — or an inline test asserts the cross-user attack scenario throws / no-ops"
  - "New Vitest in packages/convex/convex/articles/__tests__/inline-images.test.ts: user B creates article body containing user A's storageId, removes it via update — assert ctx.storage.delete(<A's blob>) is NOT called and user A's blob still exists"
  - "Mirror test in packages/convex/convex/posts/__tests__/inline-images.test.ts for the posts surface"
  - "Existing FR-06 multiset-diff tests continue to pass (legitimate same-user removals still delete)"
  - "pnpm --filter=@feel-good/convex test passes"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Convex backend / security specialist"
---

# Update mutation refuses to delete inline storage IDs the caller didn't introduce

## Context

ce:review (`feature-add-editor`, 2026-05-02) flagged this as the highest-severity finding from the adversarial reviewer (confidence 0.90, classified P1 with case for P0). The attack:

1. User A publishes article `published-article` with inline image `storageId = sA`. The body is publicly readable via `getBySlug`, so user B can read `sA`.
2. User B creates their own draft article whose body contains `{ type: "image", attrs: { storageId: "sA" } }`. The `create` mutation at `packages/convex/convex/articles/mutations.ts:24-81` writes `args.body` to DB without validating that the storageIds belong to user B.
3. User B updates their own article with an empty body. `articles/mutations.ts` lines 168-177 (`extractInlineImageStorageIds(article.body)` → multiset diff against the new empty body) returns `[sA]`.
4. The `.filter(id => !newSet.has(id))` line at 173-175 passes (newSet is empty). The dedup at line 176 keeps `sA`.
5. Lines 204-210 call `ctx.storage.delete(sA)` — user A's blob is permanently destroyed.

The same code path exists in `packages/convex/convex/posts/mutations.ts` lines 168-177 / 214-220.

The spec's FR-06 contract (multiset diff) is correct — the gap is that the mutation never proves the caller had any business deleting these IDs in the first place.

## Goal

After this ticket, a user cannot delete another user's storage blob through the article/post update mutation. Legitimate same-user deletions still work; concurrent-edit semantics for the same user are unchanged.

## Scope

- `packages/convex/convex/articles/mutations.ts` `update` and `remove` — gate `ctx.storage.delete` on caller-ownership of the storageId.
- `packages/convex/convex/posts/mutations.ts` `update` and `remove` — same.
- Tests in both `__tests__/inline-images.test.ts` files asserting the attack is blocked.

## Out of Scope

- Cover image ownership — covered today by the `coverImageStorageId` field being scoped per row.
- Cross-user blob *read* protection — `getArticleInlineImageUrl` / `getPostInlineImageUrl` give signed URLs to any authenticated user (FG_111-territory; explicit accepted trade-off in spec).
- Schema-wide migration of legacy bodies — only forward writes need to honor the gate.

## Approach

Two viable designs — pick one in implementation:

**Option A (recommended): per-upload ownership table.** Add a `inlineImageOwnership` table `{ storageId: v.id("_storage"), userId: v.id("users"), createdAt: v.number() }` with a unique index on `storageId`. `generate*InlineImageUploadUrl` writes a row at upload-URL generation time (or `getInlineImageUrl` writes-on-first-resolve). `update` / `remove` filter `removedInlineIds` to entries the table says the current user owns.

**Option B (cheaper): "introduced-by-this-article" guard.** Refuse to delete any storageId in `removedInlineIds` that wasn't already in the *previous* committed body of *this* article (i.e., re-read article.body before patch and only delete IDs that have always been there). This covers the attack since user B's first commit introduces `sA` but the previous body had no inline images, so the diff against an empty prior body cannot produce `sA` in the removed set on the FIRST update — but it does on the SECOND update where `sA` exists in both old and new and then is removed. Option B alone is insufficient unless combined with refusing the initial `create` of a body containing a storageId not owned by the caller.

Option A is the durable fix; Option B is the partial mitigation that requires also gating `create`. Recommend Option A.

- **Effort:** Medium
- **Risk:** Medium — touches the hot write path on both article and post updates; needs careful test coverage for legitimate cases.

## Implementation Steps

1. Add `inlineImageOwnership` table to `packages/convex/convex/schema.ts` with index `by_storageId` and `by_userId_and_createdAt`.
2. Update `packages/convex/convex/articles/inlineImages.ts` `generateArticleInlineImageUploadUrl` and the equivalent posts mutation: after generating the upload URL, write an ownership row keyed by the storageId returned to the client. (Note: Convex doesn't return storageId from `generateUploadUrl` — it's returned from the POST. Alternative: write the ownership row in `getArticleInlineImageUrl` first-resolve.)
3. In `articles/mutations.ts` and `posts/mutations.ts` `update` and `remove`: before the `ctx.storage.delete` loop, filter `removedInlineIds` to only the IDs the ownership table attributes to the current `appUser._id`.
4. Add Vitest cases in both `__tests__/inline-images.test.ts` files: cross-user attack scenario (assert no delete fires); legitimate same-user removal (assert delete still fires).
5. Run `pnpm --filter=@feel-good/convex test` and confirm all 219 existing tests still pass.
6. Run `pnpm --filter=@feel-good/mirror build` and confirm the upload flow still wires correctly.

## Constraints

- Must not regress legitimate same-user inline-image deletion (FR-06 contract).
- Must not require re-uploading existing inline images — legacy bodies that pre-date the ownership table should be tolerated (skipped silently rather than deleted).
- Must not introduce a new public mutation; ownership writes happen inside existing flows.
- Convex storage deletes are irreversible — err toward not-deleting if uncertain.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #1.
- Spec FR-06: `workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md`.
- `packages/convex/convex/articles/mutations.ts:168-210` (the vulnerable code).
- `.claude/rules/auth.md` — owner-check pattern.
