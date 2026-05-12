import { type Doc } from "@feel-good/convex/convex/_generated/dataModel";

/**
 * Single contact entry as returned by `api.contacts.queries.getByUsername`.
 * Mirrors `Doc<"contactEntries">` exactly.
 */
export type ContactEntry = Doc<"contactEntries">;

/**
 * Discriminator on the contact shape — one of the six supported platforms.
 * Sourced from `Doc<"contactEntries">["kind"]` so this stays in lockstep with
 * the Convex schema's literal union.
 */
export type ContactEntryKind = ContactEntry["kind"];

export const CONTACT_ENTRY_KINDS = [
  "email",
  "linkedin",
  "instagram",
  "x",
  "tiktok",
  "youtube",
] as const satisfies ReadonlyArray<ContactEntryKind>;
