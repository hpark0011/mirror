---
paths:
  - "packages/convex/convex/embeddings/**"
  - "packages/convex/convex/articles/mutations.ts"
  - "packages/convex/convex/bio/mutations.ts"
  - "packages/convex/convex/contacts/mutations.ts"
  - "packages/convex/convex/posts/mutations.ts"
  - "packages/convex/convex/chat/**"
  - "packages/convex/convex/schema.ts"
---

# Embeddings & RAG Rules

> Auto-loads under the paths above — any consumer of `contentEmbeddings`
> (the chat RAG retrieval at `chat/actions.ts`) or any ingestion source
> that schedules `internal.embeddings.actions.generateEmbedding`.

## Cross-user isolation invariant

**Every consumer that writes to `contentEmbeddings` MUST set `userId` from
`getAppUser(ctx, ctx.user._id)` — never from a client-supplied argument.**

The `by_embedding` vector index's `userId` filter at
`packages/convex/convex/chat/actions.ts` (the `vectorSearch` call inside
`streamResponse`) is the **sole** cross-user isolation boundary for the
chat agent's RAG retrieval. If any ingestion path writes a row with a
`userId` derived from client input, an attacker can plant entries that
surface in another profile's chat context.

Concrete rule, applied at every new ingestion source:

```ts
// CORRECT — server-derived owner
const appUser = await getAppUser(ctx, ctx.user._id);
await ctx.db.insert("bioEntries", {
  userId: appUser._id,   // not args.userId
  ...
});
```

The mutation's `args` validator MUST NOT include a `userId` field.
`authMutation` from `packages/convex/convex/lib/auth.ts` already requires
authentication; the only correct way to derive the `userId` is via
`getAppUser`.

When the new mutation schedules `generateEmbedding`, the action passes the
`userId` it reads off the source row through to `insertChunks` —
`generateEmbedding` itself does not re-derive the user. So a poisoned
source row poisons the embedding row. The fix is enforcing this rule at
the source-row write path.

The action-side extension of this invariant — chat-agent tool
`inputSchema` MUST NOT include any user identifier, and tool data
resolution MUST close over `profileOwnerId` server-side via the
per-request factory — lives in
[`.claude/rules/agent-parity.md`](agent-parity.md).

## Cover images are intentionally decorative (FG_150 — Option B)

Article cover images (`coverImageStorageId` in the `articles` table) are
classified as **decorative** and are out of scope for the embeddings/clone-agent
context. No `coverAlt` or `coverCaption` field exists; the only metadata about
a cover is the `coverImageOwnership` row (owner `userId` + `createdAt`).

**Rationale:** covers are typically visual mood images; the most important
article content lives in `title` and `body`. Adding a `coverAlt` field would
require non-trivial editor UI changes, plumbing through `getContentForEmbedding`,
and a dedicated embedding test. The benefit is low relative to the effort.

**Revisit condition:** if image-heavy articles ship where the cover's subject
materially differs from the body text (e.g., a cover describing a person not
mentioned in the body), promote to Option A: add `coverAlt: v.optional(v.string())`,
plumb it through `create`/`update` validators, add an alt-text input to the
cover picker, prepend `coverAlt + "\n"` to the body string in
`getContentForEmbedding`, and add a unit test asserting the chunk contains the
alt text.

## Adding a new ingestion source

1. Append the literal to `embeddingSourceTableValidator` in
   `packages/convex/convex/embeddings/schema.ts`.
2. Add a branch to `getContentForEmbedding` returning either
   `{ kind: "doc", ... }` (with a `status` field for draft/published) or
   `{ kind: "<new-kind>", title, body, userId }` (for sources without a
   draft lifecycle).
3. Add a corresponding branch to `generateEmbedding` (`embeddings/actions.ts`)
   that decides whether to run `extractPlainText` + `chunkText` (prose
   docs) or treat `content.body` as a single pre-serialized chunk
   (structured records).
4. Add a `bio-source.test.ts`-style assertion that `generateEmbedding`
   accepts the new `sourceTable` literal and produces a row in
   `contentEmbeddings`.
5. Verify the chat-side filter at `chat/actions.ts:vectorSearch(...)`
   still pins to `userId` for the new source — there is no per-source
   carveout, but a regression test confirms.
