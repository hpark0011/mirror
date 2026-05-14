---
id: PLAN_013
slug: config-agent-content-authoring
title: "Configuration agent content authoring"
date: 2026-05-14
type: feature
status: draft
branch: hpark0011/beijing
worktree: null
scope: "Extend the owner-only configuration chat helper so it can create, edit, and delete posts and articles through the same validated content write paths as the editor UI."
apps: [mirror]
packages: [convex]
verification_tier: 5
predecessor: PLAN_012
---
## Summary

Extend the `configuration` chat mode added in PLAN_012 from profile metadata management to full owner content authoring. The profile owner should be able to ask the helper to create draft or published posts/articles, update titles, slugs, categories, status, and text bodies, and delete existing posts/articles. The public clone mode remains unchanged.

This must reuse the existing post/article storage, validation, slug normalization, embedding scheduling, and navigation dispatcher patterns. The agent must never receive or accept user identifiers in tool schemas; `profileOwnerId` and `viewerId` stay server-derived from the configuration conversation.

## Current State

- Configuration mode currently attaches only `buildConfigurationTools` from `packages/convex/convex/chat/configurationTools.ts`.
- The existing configuration tools can read Bio/Contact state, fetch public profile-source text, apply Bio patches, and apply Contact patches.
- Clone mode already has owner-only tools for content status/deletion in `packages/convex/convex/chat/tools.ts`: `deletePost`, `publishPost`, `unpublishPost`, `deleteArticle`, `publishArticle`, and `unpublishArticle`.
- Full content create/update lives in `packages/convex/convex/posts/mutations.ts` and `packages/convex/convex/articles/mutations.ts`, but those are `authMutation`s that derive the user from `ctx.user`.
- The agent action cannot call those auth mutations directly because tool execution runs from the chat action context. Existing chat tools use internal mutations with server-derived `userId`.
- Post/article editor bodies are Tiptap JSON stored as `body: v.any()`. The model should not be asked to emit arbitrary editor JSON.
- The watcher in `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts` already handles structured tool results and routes through `useCloneActions`.

## Design

Add a small configuration-only content tool surface:

- `getProfileContentLibrary({ kind?, status?, limit? })` returns the owner's draft and published post/article index: kind, title, slug, category, status, created/published timestamps, and server-built list/detail/edit hrefs.
- `getProfileContentForEdit({ kind, slug })` returns one owned content item with metadata plus an agent-friendly text/body representation. It must include drafts because configuration mode is owner-only.
- `applyContentPatch({ operations })` applies create, update, and delete operations for posts/articles. It returns server-built hrefs so the client can open the affected content panel.

Use a model-friendly body schema instead of raw Tiptap JSON:

```ts
type AgentContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bulletList"; items: string[] };
```

Server helpers convert these blocks into the editor JSON shape. Existing content bodies with richer nodes can be read back as plain text plus a lossy block projection for the agent. Updating `bodyBlocks` is a full body replacement, not a rich structural diff.

Content operation shape:

- `create`: kind, title, optional slug, category, status defaulting to `draft`, and `bodyBlocks`.
- `update`: kind, current slug, optional title, optional new slug, optional category, optional status, optional `bodyBlocks`.
- `delete`: kind and slug.

Important behavior:

- For create/update success, return `{ kind, slug, status, href, editHref, action }`.
- For delete success or miss, return `{ kind, slug, deleted, href, action: "delete" }`, where `href` points to the articles/posts list.
- The client watcher uses existing dispatcher paths: create/update can call `navigateToContent` with the server-built `href` or `editHref`; delete calls `navigateToProfileSection` with the list href.
- Draft create/update should prefer `editHref` so the owner lands on `/@user/<kind>/<slug>/edit` for review. Published create/update can navigate to the public detail href.

Prompt guidance must require:

- Call `getProfileContentLibrary` before editing or deleting existing content unless the current turn already contains an unambiguous slug from a prior tool result.
- Call `getProfileContentForEdit` before replacing a body.
- Ask for confirmation before deleting content, publishing immediately, or replacing a non-empty body.
- Preserve existing slugs unless the owner explicitly asks for a rename.
- Prefer drafts for newly generated posts/articles unless the owner explicitly asks to publish.
- Do not invent facts. If source material is thin, create a draft with the available text and say what still needs owner review.

## Implementation Steps

### Step 1 - Add content href helpers for edit routes

Files:

- `packages/convex/convex/content/href.ts`
- `apps/mirror/features/content/types.ts`
- `apps/mirror/features/profile-tabs/__tests__/types.test.ts`

Add `buildContentEditHref(username, kind, slug)` returning `/@<username>/<kind>/<slug>/edit`, and re-export it to the client as `getContentEditHref`.

Keep `buildContentHref` unchanged for list/detail routes. Add href-parity tests so server and client helpers stay aligned with the existing Next.js edit routes.

### Step 2 - Add an agent-friendly body adapter

Files:

- `packages/convex/convex/content/agentBody.ts` (new)
- `packages/convex/convex/content/__tests__/agentBody.test.ts` (new)
- `packages/convex/package.json`

Implement:

- `agentBlocksToTiptapDoc(blocks)` for the tool mutation write path.
- `tiptapDocToAgentBlocks(body)` and `tiptapDocToPlainText(body)` for the read tool path.
- Validators/guards that reject external image nodes and unknown block types before they reach the content mutations.

Keep this text-only for v1. No inline images, cover images, cover video, embeds, tables, or arbitrary HTML. Add the new export to both `exports` and `typesVersions` if client-side tests or utilities import it.

### Step 3 - Extract shared post/article write helpers

Files:

- `packages/convex/convex/articles/writeHelpers.ts` (new)
- `packages/convex/convex/posts/writeHelpers.ts` (new)
- `packages/convex/convex/articles/mutations.ts`
- `packages/convex/convex/posts/mutations.ts`
- `packages/convex/convex/chat/toolMutations.ts`

Move the validation and write core out of the public auth mutations into user-scoped helpers:

- `createArticleForUser`, `updateArticleForUserBySlug`, `deleteArticleForUserBySlug`
- `createPostForUser`, `updatePostForUserBySlug`, `deletePostForUserBySlug`
- Shared status helpers or thin wrappers for publish/unpublish flows.

The public auth mutations continue to derive `appUser` with `getAppUser(ctx, ctx.user._id)` and then call the helpers. Configuration internal mutations call the same helpers with the closure-bound `profileOwnerId`.

Preserve all existing invariants:

- Slugs normalize through `generateSlug` and `assertValidSlug` at the mutation boundary.
- Category/title limits stay enforced.
- Cover ownership checks and cleanup behavior remain unchanged for UI paths.
- Text-only agent operations omit cover fields and cannot introduce storage IDs.
- Inline image ownership and orphan cleanup semantics remain intact when a body replacement removes existing inline images.
- Embeddings are generated when content is published and content changes, and deleted when content becomes draft or is removed.

### Step 4 - Add owner-scoped content read queries

Files:

- `packages/convex/convex/chat/toolQueries.ts`

Add internal queries:

- `queryProfileContentLibrary({ userId, kind?, status?, limit? })`
- `queryOwnedContentForEdit({ userId, kind, slug })`

Both queries must use the server-derived `userId` from the tool factory. They return owned drafts and published rows because configuration mode is owner-only. Results include server-built `href`, `editHref`, and list hrefs. Missing usernames return `null`, matching the existing profile-section query pattern.

Do not expose body JSON directly. `queryOwnedContentForEdit` should return `bodyBlocks` and `bodyText` from `agentBody.ts`.

### Step 5 - Add `applyContentPatch`

Files:

- `packages/convex/convex/chat/configurationTools.ts`
- `packages/convex/convex/chat/toolMutations.ts`
- `packages/convex/convex/chat/configurationPrompt.ts`

Extend `buildConfigurationTools` with the three content tools. Tool schemas must not contain `userId`, `viewerId`, `ownerId`, `username`, or any equivalent field.

`applyContentPatch` should:

- Assert `viewerId === profileOwnerId` before any query or mutation work.
- Accept at most 5 operations per call.
- Apply all operations inside one internal mutation where possible.
- Treat body replacement as explicit: only replace body when `bodyBlocks` is present.
- Return structured results with `href`, `editHref`, `slug`, `status`, and action counts.

For delete operations, use one slug per operation and return `deleted: false` instead of throwing when the row is missing or already deleted. Throw for authorization, malformed input, slug collision, or invalid body.

Update `configurationPrompt.ts` so the vocabulary names `getProfileContentLibrary`, `getProfileContentForEdit`, and `applyContentPatch`. Raise the configuration tool-step cap in `chat/actions.ts` only if the read-then-patch flow reliably needs more than the current 5 steps.

### Step 6 - Wire navigation from content patch outputs

Files:

- `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`
- `apps/mirror/app/[username]/_providers/clone-actions-context.tsx` if comments/types need widening
- `apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts`

Add an output guard for `tool-applyContentPatch`.

Navigation rules:

- Create/update draft: route to `editHref` through `navigateToContent` with the server-built href.
- Create/update published: route to the detail `href`.
- Delete: route to the section list with `navigateToProfileSection`.
- Read-only tools must not trigger navigation.

Keep idempotency keyed by `toolCallId`, matching the existing watcher behavior.

### Step 7 - Tests

Convex tests:

- Extend `packages/convex/convex/chat/__tests__/tools.test.ts`.
- Add focused `agentBody` tests.
- Add helper tests under articles/posts if the helper extraction is large enough to warrant direct coverage.

Coverage requirements:

- Configuration content tool schemas exclude all user identifiers.
- Anonymous and non-owner viewers cannot execute content configuration tools.
- `getProfileContentLibrary` returns owner drafts and published rows, and never cross-user rows.
- `getProfileContentForEdit` returns body text/blocks for owned content and returns null or throws cleanly for misses.
- `applyContentPatch` creates draft post and draft article rows with normalized slugs.
- `applyContentPatch` updates title, category, status, slug, and body without changing omitted fields.
- `applyContentPatch` rejects slug collisions.
- `applyContentPatch` delete returns `deleted: true` for owned rows and `deleted: false` for misses.
- Body replacement rejects external images or unsupported node shapes.
- Published create/update schedules embedding generation; draft/delete paths do the existing embedding cleanup.
- A failing multi-operation patch does not leave partial DB writes.

Mirror unit tests:

- Extend `use-agent-intent-watcher.test.ts` for create/update/delete outputs.
- Add href helper tests for edit routes.
- Assert read-only content tools do not navigate.

Hard Playwright verification:

- Add `apps/mirror/e2e/profile-configuration-content-authoring.authenticated.spec.ts`.
- Assertions:
  - Owner opens `/@test-user`, clicks Configure profile, and lands in `chatMode=configuration`.
  - Owner asks the helper to create a draft post with a unique title, category, and short body.
  - Test waits for URL `/@test-user/posts/<generated-slug>/edit?chat=1&chatMode=configuration&conversation=...`.
  - Edit page shows the generated title, category, draft status, and body text.
  - Owner asks the helper to update that post title/body; page reflects the edited content.
  - Owner asks the helper to delete the post after confirming; URL moves to `/@test-user/posts?...`, and the deleted title is absent from the owner list.
  - Repeat the create assertion for one article, enough to prove both content tables use the same tool path.

Verification commands:

```bash
pnpm --filter=@feel-good/convex check-types
pnpm --filter=@feel-good/convex test
pnpm --filter=@feel-good/mirror test:unit
pnpm --filter=@feel-good/mirror build
pnpm --filter=@feel-good/mirror lint
pnpm --filter=@feel-good/mirror test:e2e -- profile-configuration-content-authoring.authenticated.spec.ts
```

## Constraints & Non-Goals

- Do not let the model write raw Tiptap JSON.
- Do not support cover image, cover video, inline image, embed, or file upload authoring through the agent in this plan.
- Do not allow public clone-mode visitors to create or edit content.
- Do not expose user identifiers in tool schemas.
- Do not replace the editor UI. The agent creates and patches content, then routes the owner to the existing editor/list/detail surfaces for review.
- Do not batch large destructive edits. Keep operation caps low and prompt for confirmation before body replacement, publishing, or deletion.
- Do not add a parallel navigation route from server tools. Tool handlers return structured results; the client watcher dispatches through `useCloneActions`.

## Risks

- Refactoring post/article mutations is a high-blast-radius change. Keep helper extraction mechanical and verify existing editor e2e tests still pass.
- Body conversion is intentionally lossy for complex editor documents. The prompt must call this out when an edit would replace an existing rich body.
- Published agent-created content can leak hallucinated facts. Default to drafts and require explicit owner wording to publish.
- Storage deletion after body replacement is best-effort and not fully transactional. This mirrors the current editor mutation behavior and should not be made stricter in this plan.