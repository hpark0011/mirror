/// <reference types="vite/client" />

// Mirrors the env-var defaults used by the other schema-importing specs so a
// transitive import (embeddings/schema → config, chat/schema, …) never trips
// on a missing var while this purely-static parity check loads the schema.
process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { describe, expect, it } from "vitest";
import schema from "../../schema";
import { INDEXABLE_CONTENT_SOURCE_TABLES } from "../sourceRegistry";

/**
 * Schema → registry parity ledger.
 *
 * The TypeScript `satisfies Record<IndexableContentSourceTable, …>` on the
 * embedding readers/listers plus the existing "registry drift" test already
 * enforce the registry → reader/lister direction. The *uncovered* direction —
 * the one code review keeps catching by hand — is schema → registry: a new
 * user-authored content table lands in `schema.ts`, ships a mutation, and is
 * silently never registered as a RAG source, so the clone agent is blind to
 * it and nothing fails.
 *
 * This test closes that gap by forcing every schema table to be a *conscious*
 * decision. A newly added table must be classified as either:
 *   1. RAG-indexable  → add it to `contentSourceRegistry`
 *      (`content/sourceRegistry.ts`) so it flows into `contentEmbeddings`, or
 *   2. Not user content → add it to `NON_RAG_TABLES` below with a one-line
 *      reason.
 *
 * Until the author does one of those, this test fails. That converts the
 * recurring "forgot to wire RAG for the new content type" miss into a
 * reviewed, intentional choice recorded in the diff.
 */

// Tables intentionally excluded from RAG ingestion. Key = table name in
// `schema.ts`; value = the reason it carries no user-authored content the
// clone agent should retrieve. Adding a row here is a deliberate "the clone
// does not read this" statement and should be scrutinized in review.
const NON_RAG_TABLES: Record<string, string> = {
  users: "Account/auth identity — profile metadata, not authored content.",
  conversations:
    "Chat threads — transient dialogue, not a clone knowledge source.",
  contentEmbeddings:
    "The embedding store itself — the RAG sink, never a source.",
  coverImageOwnership:
    "Storage-ownership bookkeeping for cover images (no prose).",
  inlineImageOwnership:
    "Storage-ownership bookkeeping for inline images (no prose).",
  betaAllowlist: "Access-control allowlist — operational, not user content.",
  waitlistRequests: "Signup-funnel records — operational, not user content.",
  testOtpStore: "Test-only Playwright auth fixture — never production data.",
};

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

describe("content source registry — schema↔registry parity ledger", () => {
  it("every schema table is classified as RAG-indexable or explicitly non-RAG", () => {
    const schemaTables = sorted(Object.keys(schema.tables));
    const classified = sorted([
      ...INDEXABLE_CONTENT_SOURCE_TABLES,
      ...Object.keys(NON_RAG_TABLES),
    ]);

    const unclassified = schemaTables.filter((t) => !classified.includes(t));
    const ghosts = classified.filter((t) => !schemaTables.includes(t));

    expect(
      unclassified,
      `Unclassified schema table(s): ${unclassified.join(", ")}.\n` +
        "Each new table MUST be a conscious RAG decision. Either:\n" +
        "  • add it to contentSourceRegistry (content/sourceRegistry.ts) if " +
        "it holds user-authored content the clone agent should retrieve, or\n" +
        "  • add it to NON_RAG_TABLES in this file with a one-line reason.",
    ).toEqual([]);

    expect(
      ghosts,
      `NON_RAG_TABLES / registry name(s) not present in schema.ts: ` +
        `${ghosts.join(", ")}. Remove the stale entry — it can only mask a ` +
        "future table that accidentally reuses the name.",
    ).toEqual([]);

    // Belt-and-suspenders: a table must not be both indexable and non-RAG.
    const overlap = INDEXABLE_CONTENT_SOURCE_TABLES.filter(
      (t) => t in NON_RAG_TABLES,
    );
    expect(
      overlap,
      `Table(s) marked both RAG-indexable and non-RAG: ${overlap.join(", ")}.`,
    ).toEqual([]);

    // Sanity: classification is an exact partition of the schema.
    expect(classified).toEqual(schemaTables);
  });
});
