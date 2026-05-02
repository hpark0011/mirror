/**
 * Serializes a bio entry into subject-neutral natural prose suitable for
 * vector embedding and direct injection into the chat agent's system prompt.
 *
 * The voice is intentionally subject-neutral — neither first-person ("I
 * worked at Acme") nor third-person-with-pronoun ("the author worked at
 * Acme") — so the chunk reads cleanly under either system-prompt voicing
 * the agent currently uses.
 *
 * Pure function — no Convex `ctx`, easy to unit-test directly.
 *
 * Lives in the Convex package because it's called by
 * `internal.embeddings.queries.getContentForEmbedding`, which runs
 * server-side and cannot import from `apps/mirror/`.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function formatMonthYear(epochMs: number): string {
  // Anchor on UTC to keep the displayed month invariant of the server
  // timezone — bio entries are stored as UTC first-of-month epoch ms.
  const date = new Date(epochMs);
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${month} ${year}`;
}

export interface BioEntryForSerialization {
  kind: "work" | "education";
  title: string;
  startDate: number;
  endDate: number | null;
  description?: string;
  link?: string;
}

export function serializeBioEntryForEmbedding(
  entry: BioEntryForSerialization,
): string {
  const start = formatMonthYear(entry.startDate);
  const end = entry.endDate === null ? "present" : formatMonthYear(entry.endDate);

  // Verb is kind-discriminated. Both forms read as subject-neutral statements
  // of fact: "Worked as ...", "Studied ...".
  const verbPhrase =
    entry.kind === "work"
      ? `Worked as ${entry.title}`
      : `Studied ${entry.title}`;

  // Date phrasing: ranged ("from <start> to <end>") or ongoing
  // ("from <start> to present"). Both close with a period for sentence-ness.
  const lead = `${verbPhrase} from ${start} to ${end}.`;

  const tail: string[] = [];
  const description = entry.description?.trim();
  if (description) {
    // Append exactly as typed; the unit test verifies no markdown / bullet
    // markers leak in.
    const punctuated = /[.!?]$/.test(description) ? description : `${description}.`;
    tail.push(punctuated);
  }
  const link = entry.link?.trim();
  if (link) {
    tail.push(`More info: ${link}`);
  }

  return tail.length > 0 ? `${lead} ${tail.join(" ")}` : lead;
}
