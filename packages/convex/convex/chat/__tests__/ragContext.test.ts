import { describe, expect, it } from "vitest";
import {
  buildRagContext,
  RAG_CHUNK_MAX_CHARS,
  RAG_CONTEXT_MAX_CHARS,
  RAG_CONTEXT_HEADER,
} from "../actions";

describe("buildRagContext (FR-08)", () => {
  it("truncates a single chunk whose text exceeds RAG_CHUNK_MAX_CHARS", () => {
    const longText = "x".repeat(RAG_CHUNK_MAX_CHARS + 500);
    const result = buildRagContext([{ title: "Post", chunkText: longText }]);

    // The truncated chunk should contribute at most RAG_CHUNK_MAX_CHARS of body.
    // We check that the raw 'x' run in the output is bounded.
    const xRun = result.match(/x+/);
    expect(xRun).not.toBeNull();
    expect(xRun![0].length).toBe(RAG_CHUNK_MAX_CHARS);
  });

  it("caps total ragContext at RAG_CONTEXT_MAX_CHARS with 5 max-size chunks", () => {
    const bigChunk = "a".repeat(RAG_CHUNK_MAX_CHARS);
    const chunks = Array.from({ length: 5 }, (_, i) => ({
      title: `Post ${i}`,
      chunkText: bigChunk,
    }));

    const result = buildRagContext(chunks);
    expect(result.length).toBeLessThanOrEqual(RAG_CONTEXT_MAX_CHARS);
  });

  it("preserves input order deterministically", () => {
    const chunks = [
      { title: "First", chunkText: "alpha" },
      { title: "Second", chunkText: "beta" },
      { title: "Third", chunkText: "gamma" },
    ];
    const result = buildRagContext(chunks);

    const firstIdx = result.indexOf("First");
    const secondIdx = result.indexOf("Second");
    const thirdIdx = result.indexOf("Third");

    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
    expect(thirdIdx).toBeGreaterThan(secondIdx);
  });

  it("returns empty string when no chunks", () => {
    expect(buildRagContext([])).toBe("");
  });

  // Issue m9 — guards against accidental rename or deletion of the header.
  it("output contains the literal RAG_CONTEXT_HEADER string", () => {
    const result = buildRagContext([
      { title: "Post", chunkText: "body", slug: "some-slug" },
    ]);
    expect(result).toContain(RAG_CONTEXT_HEADER);
    // Lock the human-readable phrase too — a future rename that keeps the
    // markdown shape but changes the words would slip past a substring check
    // alone, so assert the words.
    expect(RAG_CONTEXT_HEADER).toContain("Relevant Background and Writing");
  });

  // Issue iter3-Finding1 — non-vacuous coverage of the slug branch:
  // BOTH branches must be asserted, otherwise the conditional could pass by
  // being unreachable.
  it("renders [Read more] link when slug is a non-empty string", () => {
    const result = buildRagContext([
      {
        title: "Article Title",
        chunkText: "article body text",
        slug: "some-article-slug",
      },
    ]);
    expect(result).toContain("[Read more](/some-article-slug)");
  });

  it("does NOT render [Read more] link when slug is undefined (bio chunk)", () => {
    const result = buildRagContext([
      {
        title: "Bio Entry Title",
        chunkText: "Worked as Senior Engineer at Acme from January 2022 to present.",
        // slug intentionally omitted — bio chunks are stored without a slug
      },
    ]);
    expect(result).not.toContain("[Read more]");
  });

  it("does NOT render [Read more] link when slug is an empty string", () => {
    const result = buildRagContext([
      {
        title: "Edge",
        chunkText: "body",
        slug: "",
      },
    ]);
    expect(result).not.toContain("[Read more]");
  });
});
