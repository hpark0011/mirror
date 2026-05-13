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
import { v, type Infer } from "convex/values";

// Source-of-truth tuple for the supported contact platforms. Server-side
// callers (mutations, queries) derive `MAX_CONTACT_ENTRIES` from
// `.length`, and the client derives the same constant from
// `CONTACT_ENTRY_KINDS` in `apps/mirror/features/contact/types.ts`. The
// two lists are kept in lockstep by `contactEntryKindValidator`'s `Infer`
// type at every type-checked boundary.
export const CONTACT_ENTRY_KIND_VALUES = [
  "email",
  "linkedin",
  "instagram",
  "x",
  "tiktok",
  "youtube",
] as const;

export const contactEntryKindValidator = v.union(
  v.literal("email"),
  v.literal("linkedin"),
  v.literal("instagram"),
  v.literal("x"),
  v.literal("tiktok"),
  v.literal("youtube"),
);

// Drift guard: the tuple of platform literals and the validator's union
// must be identical. Adding a 7th platform to one without the other is a
// compile-time error on the assignment below.
type _Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const _contactEntryKindDriftCheck: _Equal<
  (typeof CONTACT_ENTRY_KIND_VALUES)[number],
  Infer<typeof contactEntryKindValidator>
> = true;
void _contactEntryKindDriftCheck;

export const contactEntryFields = {
  userId: v.id("users"),
  kind: contactEntryKindValidator,
  value: v.string(),
};

export const contactEntriesTable = defineTable(contactEntryFields)
  .index("by_userId", ["userId"])
  .index("by_userId_and_kind", ["userId", "kind"]);
