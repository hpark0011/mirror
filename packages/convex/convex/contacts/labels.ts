// Human-readable display labels for each contact platform. Kept in the
// Convex package so the server mutation's "<X> contact already exists"
// error message and the client's contact-kind presentation record render
// the same string for every platform without two source-of-truth lists.
//
// `kind` is typed as the literal-tuple member from
// `CONTACT_ENTRY_KIND_VALUES`, so adding a 7th platform to the validator
// without widening this map is a compile-time error at every consumer.

import { type Infer } from "convex/values";
import { contactEntryKindValidator } from "./schema";

export type ContactEntryKind = Infer<typeof contactEntryKindValidator>;

export const CONTACT_KIND_LABEL: Record<ContactEntryKind, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
};
