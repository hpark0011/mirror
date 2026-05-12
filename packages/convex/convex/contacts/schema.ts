/**
 * Contact entries table — one canonical email / social-profile URL per
 * platform per user.
 *
 * The `by_userId_and_kind` index pins the "one entry per platform" invariant
 * at the storage layer: `contacts/mutations.ts:create` queries this index for
 * an existing `(userId, kind)` pair and rejects the insert when a row is
 * already present. Without the index this would be an O(N) scan on
 * `bioEntries`-style `by_userId` reads.
 *
 * `value` is the payload — an email address for `kind: "email"`, an https URL
 * otherwise. Validation lives in `contacts/mutations.ts` (server trust
 * boundary) and the Zod schema in `apps/mirror/features/contact/lib/schemas/`.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const contactEntryKindValidator = v.union(
  v.literal("email"),
  v.literal("linkedin"),
  v.literal("instagram"),
  v.literal("x"),
  v.literal("tiktok"),
  v.literal("youtube"),
);

export const contactEntryFields = {
  userId: v.id("users"),
  kind: contactEntryKindValidator,
  value: v.string(),
};

export const contactEntriesTable = defineTable(contactEntryFields)
  .index("by_userId", ["userId"])
  .index("by_userId_and_kind", ["userId", "kind"]);
