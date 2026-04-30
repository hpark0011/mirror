import { type Doc } from "@feel-good/convex/convex/_generated/dataModel";

/**
 * Single bio entry as returned by `api.bio.queries.getByUsername`. Mirrors
 * `Doc<"bioEntries">` exactly — the public query strips no fields beyond
 * sorting and the 50-row cap.
 */
export type BioEntry = Doc<"bioEntries">;

/**
 * Discriminator on the bio entry shape — `"work"` or `"education"`. Sourced
 * from `Doc<"bioEntries">["kind"]` so this stays in lockstep with the Convex
 * schema's literal union.
 */
export type BioEntryKind = BioEntry["kind"];
