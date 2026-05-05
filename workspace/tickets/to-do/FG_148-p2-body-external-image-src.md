---
id: FG_148
title: "Article body rejects image nodes with external src URLs"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "The article body is stored as v.any() with no server-side image-src validation; a direct mutation call can embed external image URLs in published articles."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`packages/convex/convex/articles/mutations.ts` `create` and `update` reject (or strip) image nodes in `body` whose `src` is set without a corresponding `storageId`."
  - "An integration test calls `create` directly with a body containing `{type:'image', attrs:{src:'https://attacker/track.gif'}}` (no storageId) and asserts the mutation throws or strips the node."
  - "Bodies authored via the editor (which always set storageId for inserted images) continue to work."
  - "`pnpm --filter=@feel-good/convex exec tsc --noEmit` passes."
owner_agent: "convex backend engineer (security)"
---

# Article body rejects image nodes with external src URLs

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; security reviewer). `packages/convex/convex/articles/mutations.ts:30,101` validates `body: v.any()`. A caller bypassing the editor client can submit a Tiptap body that includes `{type: "image", attrs: {src: "https://attacker.com/track.gif"}}` (no `storageId`). The server stores it verbatim. `mapInlineImages` at `packages/convex/convex/articles/queries.ts:122-134` rewrites `src` only for nodes that have a `storageId`; external-`src` image nodes pass through unchanged. The public viewer's client-side `sanitizeContent` allows `https://` URLs (it only blocks `javascript:` / `data:`), so the external URL renders.

`bodyWalk.ts:185-208`'s `collectExternalImageSrcs` already acknowledges external URLs as a recognized case for markdown imports — confirming the server model permits them.

**Risk:** any authenticated user who calls the mutation directly can embed arbitrary HTTPS image URLs in published articles. Readers loading the article cause their browsers to fetch the attacker-controlled URL — tracking pixels, fingerprinting, abuse of external image hosting.

## Goal

The server rejects (or sanitizes) image nodes that carry an external `src` without a `storageId`.

## Scope

- Walk the body server-side in `create` and `update` and reject (or strip) image nodes lacking `storageId`.
- Cover the path with an integration test.

## Out of Scope

- Markdown-import flow that intentionally allows external URLs (must remain working).
- Other Tiptap node types (only `image` is the concrete vector).
- Client-side viewer changes.

## Approach

Reuse `extractInlineImageStorageIds` (or a similar walker) inside `create`/`update`. For each image node found, require `attrs.storageId` to be set; if missing, either throw or set `attrs.src = ""` (strip). Recommend strip-and-warn for editor-authored bodies (defense in depth) and reject for bodies whose origin we don't control.

A simpler initial approach: reject. The editor always inserts images with `storageId`, so legitimate flows are unaffected.

- **Effort:** Medium
- **Risk:** Medium (must not break the markdown import flow)

## Implementation Steps

1. Audit `extractInlineImageStorageIds` and `bodyWalk.ts:collectExternalImageSrcs` to understand the markdown-import contract.
2. Add a helper `validateNoExternalImageSrcs(body)` that walks the body and throws if any image node has `src` set but no `storageId`. Allow it on a per-call basis (markdown import bypasses).
3. Call the validator inside `create` and `update` for editor-authored writes. Markdown import uses a separate path (verify).
4. Add an integration test that posts a body with an external-src image directly to `create` and asserts the mutation throws.
5. Run the e2e suite to confirm legitimate inline image flows still pass.

## Constraints

- Must not break the markdown-import flow that intentionally allows external URLs.
- Validator must be idempotent and bounded (don't recurse unbounded if body is malformed).

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- Existing helpers: `packages/convex/convex/articles/bodyWalk.ts`
