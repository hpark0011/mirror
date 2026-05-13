---
id: FG_207
title: "backfillConversationMode resumes via cursor and signals completion"
date: 2026-05-13
type: refactor
status: completed
priority: p1
description: "The chat-mode backfill migration restarts at offset 0 on every invocation and breaks at scanned >= limit, so deployments with more than `limit` conversations leave a tail of rows with mode=undefined. The narrow phase that removes v.optional from the mode validator will then fail Convex schema validation on those un-backfilled rows."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "packages/convex/convex/migrations/chat.ts accepts an optional `cursor` arg and returns `continueCursor` and `isDone` alongside `scanned` and `patched`"
  - "The migration uses `.paginate({ cursor, numItems: limit })` so successive invocations advance through the table"
  - "A unit test asserts that running the migration with a small limit against N rows where N > limit eventually patches every row via cursor chaining"
  - "Running the migration twice with `dryRun: false` is idempotent — the second run reports `patched: 0` and `isDone: true`"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/migrations/__tests__/ passes"
owner_agent: "Convex migrations engineer"
---

# backfillConversationMode resumes via cursor and signals completion

## Context

`packages/convex/convex/migrations/chat.ts:20-28` implements `backfillConversationMode`:

```ts
for await (const conversation of ctx.db.query("conversations")) {
  if (scanned >= limit) break;
  scanned += 1;
  if (conversation.mode !== undefined) continue;
  patched += 1;
  if (!dryRun) {
    await ctx.db.patch(conversation._id, { mode: "clone" });
  }
}
```

Three reviewers flagged this independently:
- `data` reviewer — P1, confidence 0.97 (narrow phase will reject un-backfilled rows)
- `reliability` reviewer — P2, confidence 0.95 (operator cannot distinguish "done" from "first N already done")
- `concurrency` reviewer — P3, confidence 0.70 (rescan cost on every invocation)

The for-await always starts at the lowest `_creationTime`. After the first run with `limit: 100` patches the first 100, the second invocation re-scans the same 100 rows (now all `mode !== undefined`, so they're skipped via `continue`) and the count of `patched` returns 0. An operator reads `patched: 0` and concludes "migration complete" — but rows 101..N still have `mode: undefined`. The next PR that changes the schema to `mode: chatModeValidator` (non-optional) will hit Convex schema validation failures on those rows during read.

## Goal

The migration is resumable, idempotent, and reports completion deterministically. An operator can call it in a loop until `isDone: true` and be confident no row was missed.

## Scope

- `packages/convex/convex/migrations/chat.ts`:
  - Accept `cursor: v.optional(v.string())` arg.
  - Use `.paginate({ cursor, numItems: limit })` instead of for-await with manual counter.
  - Return `{ scanned, patched, dryRun, continueCursor: string | null, isDone: boolean }`.
- New unit test in `packages/convex/convex/migrations/__tests__/chat.test.ts` covering: cursor chaining, idempotency on re-run, dry-run vs real-run accuracy.

## Out of Scope

- Adding a runbook / invocation documentation (covered in FG_214).
- The narrow phase that removes `v.optional` from the schema field (a follow-up PR).
- Adding a cron schedule that runs the migration automatically.

## Approach

Replace the for-await with paginate. Paginate is the canonical Convex pattern for incremental, resumable scans.

```ts
const result = await ctx.db
  .query("conversations")
  .paginate({ cursor: args.cursor ?? null, numItems: limit });
for (const conversation of result.page) {
  scanned += 1;
  if (conversation.mode !== undefined) continue;
  patched += 1;
  if (!dryRun) {
    await ctx.db.patch(conversation._id, { mode: "clone" });
  }
}
return {
  scanned,
  patched,
  dryRun,
  continueCursor: result.continueCursor,
  isDone: result.isDone,
};
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Update the args validator to add `cursor: v.optional(v.string())`.
2. Update the returns validator to include `continueCursor: v.union(v.string(), v.null())` and `isDone: v.boolean()`.
3. Replace the for-await with `.paginate({ cursor: args.cursor ?? null, numItems: limit })`.
4. Write a unit test that inserts 5 conversations, calls the migration with `limit: 2`, then chains successive calls with the returned cursor until `isDone === true`. Assert all five rows have `mode: "clone"` at the end.
5. Write a second test that runs the migration with `dryRun: true` first, asserts no rows were patched, then runs with `dryRun: false` and asserts all rows are patched.
6. Document the loop pattern in a code comment on the migration so callers know to chain until `isDone`.

## Constraints

- Must remain an `internalMutation` — no public exposure.
- Default `dryRun: true` must be preserved.
- Existing return fields (`scanned`, `patched`, `dryRun`) must keep their meaning so any existing caller continues to work.

## Resources

- PR #93: https://github.com/hpark0011/mirror/pull/93
- `.claude/rules/convex.md` Pagination section — canonical paginate pattern
- `workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md` Step 4
