import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

export type ParsedConversationId =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "valid"; id: Id<"conversations"> };

/** Convex IDs are 31-32 char Crockford base32 strings */
const CONVEX_ID_RE = /^[0-9a-hjkmnp-tv-z]{31,32}$/;

export function parseConversationId(
  raw: string | string[] | undefined,
): ParsedConversationId {
  if (!raw || typeof raw !== "string") return { status: "none" };
  if (!CONVEX_ID_RE.test(raw)) return { status: "invalid" };
  return { status: "valid", id: raw as Id<"conversations"> };
}
