/**
 * Bio entries table — structured work / education history per user.
 *
 * NOTE: There is also a `bio` string column on the `users` table. That field
 * is the legacy one-line tagline ("Designer in NYC") and is unrelated to this
 * table. Naming overlap is intentional but documented to prevent confusion.
 * Renaming the legacy field is a separate spec.
 *
 * `startDate` / `endDate` are stored as epoch ms anchored to the first of the
 * month UTC (calendar-month granularity). `endDate: null` means "Present" —
 * the entry stays at the top of its `kind` until a newer one arrives.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const bioEntryKindValidator = v.union(
  v.literal("work"),
  v.literal("education"),
);

export const bioEntryFields = {
  userId: v.id("users"),
  kind: bioEntryKindValidator,
  title: v.string(),
  startDate: v.number(),
  endDate: v.union(v.number(), v.null()),
  description: v.optional(v.string()),
  link: v.optional(v.string()),
};

export const bioEntriesTable = defineTable(bioEntryFields).index("by_userId", [
  "userId",
]);
