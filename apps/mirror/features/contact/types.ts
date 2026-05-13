import { type Doc } from "@feel-good/convex/convex/_generated/dataModel";
import { CONTACT_ENTRY_KIND_VALUES } from "@feel-good/convex/convex/contacts/schema";

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

// Re-exported from the Convex schema's source-of-truth tuple so client and
// server stay in lockstep automatically when a new platform is added.
export const CONTACT_ENTRY_KINDS: ReadonlyArray<ContactEntryKind> =
  CONTACT_ENTRY_KIND_VALUES;
