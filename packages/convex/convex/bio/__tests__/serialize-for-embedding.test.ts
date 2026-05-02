import { describe, expect, it } from "vitest";
import {
  serializeBioEntryForEmbedding,
  type BioEntryForSerialization,
} from "../serializeForEmbedding";

// UTC first-of-month epoch ms helpers — matches how bio entries are stored.
function utcMonth(year: number, month: number): number {
  return Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
}

const baseWork: BioEntryForSerialization = {
  kind: "work",
  title: "Senior Engineer at Acme",
  startDate: utcMonth(2022, 1),
  endDate: utcMonth(2024, 3),
};

const baseEducation: BioEntryForSerialization = {
  kind: "education",
  title: "Computer Science at MIT",
  startDate: utcMonth(2014, 9),
  endDate: utcMonth(2018, 5),
};

describe("serializeBioEntryForEmbedding (FR-12)", () => {
  it("ranged work entry matches /^Worked as .+ from .+ to .+\\.$/", () => {
    const result = serializeBioEntryForEmbedding(baseWork);
    expect(result).toMatch(/^Worked as .+ from .+ to .+\.$/);
    expect(result).toBe(
      "Worked as Senior Engineer at Acme from January 2022 to March 2024.",
    );
  });

  it("ongoing work entry uses 'present' instead of an end month", () => {
    const ongoing: BioEntryForSerialization = {
      ...baseWork,
      endDate: null,
    };
    const result = serializeBioEntryForEmbedding(ongoing);
    expect(result).toMatch(/^Worked as .+ from .+ to present\.?/i);
    expect(result).toBe(
      "Worked as Senior Engineer at Acme from January 2022 to present.",
    );
  });

  it("education entry starts with 'Studied'", () => {
    const result = serializeBioEntryForEmbedding(baseEducation);
    expect(result).toMatch(/^Studied /);
    expect(result).toBe(
      "Studied Computer Science at MIT from September 2014 to May 2018.",
    );
  });

  it("appends description after the date sentence", () => {
    const result = serializeBioEntryForEmbedding({
      ...baseWork,
      description: "Led the migration of the billing pipeline",
    });
    expect(result).toBe(
      "Worked as Senior Engineer at Acme from January 2022 to March 2024. Led the migration of the billing pipeline.",
    );
  });

  it("appends link after description with 'More info:' prefix", () => {
    const result = serializeBioEntryForEmbedding({
      ...baseWork,
      description: "Led billing.",
      link: "https://acme.com/blog/billing",
    });
    expect(result).toBe(
      "Worked as Senior Engineer at Acme from January 2022 to March 2024. Led billing. More info: https://acme.com/blog/billing",
    );
  });

  it("output contains no key-value markers (kind:, Dates:)", () => {
    const result = serializeBioEntryForEmbedding({
      ...baseWork,
      description: "Did stuff",
      link: "https://acme.com",
    });
    expect(result).not.toMatch(/kind:/i);
    expect(result).not.toMatch(/dates:/i);
    expect(result).not.toMatch(/^- /m);
    expect(result).not.toContain("**");
  });

  it("output is subject-neutral (no first-person, no 'the author')", () => {
    // Voice constraint per iter2-Finding6 — neither "I worked" nor
    // "the author worked" so the chunk reads cleanly under either
    // first-person or third-person agent voicing.
    const result = serializeBioEntryForEmbedding({
      ...baseWork,
      description: "Did stuff",
    });
    expect(result).not.toMatch(/^I /);
    expect(result).not.toMatch(/the author/i);
    expect(result).not.toMatch(/\bI worked\b/);
  });

  it("trims description whitespace and adds trailing period if missing", () => {
    const result = serializeBioEntryForEmbedding({
      ...baseWork,
      description: "   short tagline   ",
    });
    expect(result).toBe(
      "Worked as Senior Engineer at Acme from January 2022 to March 2024. short tagline.",
    );
  });

  it("preserves explicit end punctuation in description", () => {
    const result = serializeBioEntryForEmbedding({
      ...baseWork,
      description: "Built things!",
    });
    expect(result).toContain("Built things!");
    // No double-period after "!"
    expect(result).not.toContain("things!.");
  });

  it("omits link when blank string", () => {
    const result = serializeBioEntryForEmbedding({
      ...baseWork,
      link: "   ",
    });
    expect(result).not.toContain("More info:");
  });

  it("formats single-month spans normally (start === end month)", () => {
    const result = serializeBioEntryForEmbedding({
      ...baseWork,
      startDate: utcMonth(2024, 6),
      endDate: utcMonth(2024, 6),
    });
    expect(result).toBe(
      "Worked as Senior Engineer at Acme from June 2024 to June 2024.",
    );
  });
});
