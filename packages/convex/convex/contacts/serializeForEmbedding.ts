/**
 * Serializes a contact entry into subject-neutral natural prose suitable for
 * vector embedding and direct injection into the chat agent's system prompt.
 *
 * Mirrors `bio/serializeForEmbedding.ts` — subject-neutral voice ("Email
 * address: …"), pure function (no Convex ctx), called by
 * `internal.embeddings.queries.getContentForEmbedding`'s contact branch.
 *
 * The chunk is short by construction (a single label + value), so the
 * embedding pipeline treats it as one chunk with `chunkIndex: 0` — same
 * single-chunk path bio uses.
 */

export interface ContactEntryForSerialization {
  kind: "email" | "linkedin" | "instagram" | "x" | "tiktok" | "youtube";
  value: string;
}

const KIND_PROSE: Record<ContactEntryForSerialization["kind"], string> = {
  email: "Email address",
  linkedin: "LinkedIn profile",
  instagram: "Instagram profile",
  x: "X profile",
  tiktok: "TikTok profile",
  youtube: "YouTube channel",
};

export function serializeContactEntryForEmbedding(
  entry: ContactEntryForSerialization,
): string {
  const label = KIND_PROSE[entry.kind];
  return `${label}: ${entry.value.trim()}.`;
}
