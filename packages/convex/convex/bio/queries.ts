import { v } from "convex/values";
import { type Doc } from "../_generated/dataModel";
import { internalQuery, query } from "../_generated/server";
import { bioEntryKindValidator } from "./schema";

const MAX_PUBLIC_ENTRIES = 50;

const bioEntryReturnValidator = v.object({
  _id: v.id("bioEntries"),
  _creationTime: v.number(),
  userId: v.id("users"),
  kind: bioEntryKindValidator,
  title: v.string(),
  startDate: v.number(),
  endDate: v.union(v.number(), v.null()),
  description: v.optional(v.string()),
  link: v.optional(v.string()),
});

/**
 * Public query — resolves `username -> userId` server-side via the
 * `by_username` index (mirrors the articles/posts pattern), then returns
 * up to 50 entries sorted desc by `startDate` (newest first), ties broken
 * by `_creationTime` desc.
 *
 * Returns `null` when no user matches the username (so the parallel-route
 * layout can preload it without a separate userId fetch).
 */
export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(v.array(bioEntryReturnValidator), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (!user) {
      return null;
    }

    const entries = await ctx.db
      .query("bioEntries")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Sort desc by startDate, ties broken by _creationTime desc. Done in
    // memory because the index is on userId only — at the 50-entry cap this
    // is trivial.
    entries.sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return b.startDate - a.startDate;
      }
      return b._creationTime - a._creationTime;
    });

    return entries.slice(0, MAX_PUBLIC_ENTRIES).map((entry) => toReturn(entry));
  },
});

/**
 * Internal — fetches a single entry by id. Used by the embedding pipeline.
 */
export const getById = internalQuery({
  args: { id: v.id("bioEntries") },
  returns: v.union(bioEntryReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) return null;
    return toReturn(entry);
  },
});

function toReturn(entry: Doc<"bioEntries">) {
  return {
    _id: entry._id,
    _creationTime: entry._creationTime,
    userId: entry.userId,
    kind: entry.kind,
    title: entry.title,
    startDate: entry.startDate,
    endDate: entry.endDate,
    description: entry.description,
    link: entry.link,
  };
}
