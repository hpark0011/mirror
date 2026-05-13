import { v } from "convex/values";
import { type Doc } from "../_generated/dataModel";
import { internalQuery, query } from "../_generated/server";
import {
  CONTACT_ENTRY_KIND_VALUES,
  contactEntryKindValidator,
} from "./schema";

// Derived from the validator's source-of-truth tuple so adding a 7th platform
// widens the cap automatically. The matching client constant lives at
// `apps/mirror/features/contact/types.ts`'s `CONTACT_ENTRY_KINDS.length`.
const MAX_CONTACT_ENTRIES = CONTACT_ENTRY_KIND_VALUES.length;

const contactEntryReturnValidator = v.object({
  _id: v.id("contactEntries"),
  _creationTime: v.number(),
  userId: v.id("users"),
  kind: contactEntryKindValidator,
  value: v.string(),
});

/**
 * Public query — resolves `username -> userId` server-side via the
 * `by_username` index (mirrors the bio pattern), then returns the user's
 * contact entries sorted by `_creationTime` desc (most-recently-added
 * first).
 *
 * Returns `null` when no user matches the username so the parallel-route
 * layout can preload it without a separate userId fetch.
 */
export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(v.array(contactEntryReturnValidator), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (!user) return null;

    const entries = await ctx.db
      .query("contactEntries")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    entries.sort((a, b) => b._creationTime - a._creationTime);

    return entries.slice(0, MAX_CONTACT_ENTRIES).map((entry) => toReturn(entry));
  },
});

/**
 * Internal — fetches a single entry by id. Used by the embedding pipeline.
 */
export const getById = internalQuery({
  args: { id: v.id("contactEntries") },
  returns: v.union(contactEntryReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) return null;
    return toReturn(entry);
  },
});

function toReturn(entry: Doc<"contactEntries">) {
  return {
    _id: entry._id,
    _creationTime: entry._creationTime,
    userId: entry.userId,
    kind: entry.kind,
    value: entry.value,
  };
}
