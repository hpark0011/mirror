import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Backfills the `mode` field on legacy `conversations` rows that were written
 * before the `mode` column was introduced (PLAN_012 widen-migrate-narrow).
 *
 * ## Runbook
 *
 * Step 1 — Dry-run inspection. Confirm the scanned/patched counts are sane.
 *
 *   pnpm --filter=@feel-good/convex exec convex run \
 *     migrations/chat:backfillConversationMode '{"dryRun": true}'
 *
 * Step 2 — Real run, looped until isDone. The migration paginates with
 * `numItems: limit` (default 100), so any deployment with > limit rows
 * MUST loop on `continueCursor` until `isDone === true`.
 *
 *   let cursor: string | null = null;
 *   while (true) {
 *     const result = await ctx.runMutation(
 *       internal.migrations.chat.backfillConversationMode,
 *       { dryRun: false, cursor },
 *     );
 *     if (result.isDone) break;
 *     cursor = result.continueCursor;
 *   }
 *
 * Or invoked from the CLI in a shell loop — call repeatedly until
 * a run reports `"isDone": true`.
 *
 * Step 3 — Completion gate. Before opening the narrow-phase PR (the PR
 * that changes `mode: v.optional(chatModeValidator)` to
 * `mode: chatModeValidator` in `packages/convex/convex/chat/schema.ts`),
 * verify zero rows remain by running the dry-run sweep to completion:
 *
 *   # repeat with the returned continueCursor until isDone:
 *   pnpm --filter=@feel-good/convex exec convex run \
 *     migrations/chat:backfillConversationMode '{"dryRun": true}'
 *
 * Every page must report `patched: 0`. If any page reports patched > 0,
 * the narrow phase will fail Convex schema validation on the
 * still-undefined-mode rows during read. Re-run Step 2 and re-verify.
 *
 * This migration is idempotent — rows already patched are skipped by the
 * `conversation.mode !== undefined` check, so repeat invocations are safe.
 */
export const backfillConversationMode = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    dryRun: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const limit = args.limit ?? 100;
    let scanned = 0;
    let patched = 0;

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
  },
});
