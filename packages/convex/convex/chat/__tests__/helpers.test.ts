import { describe, expect, it } from "vitest";
import { TONE_PRESETS, type TonePreset } from "../tonePresets";
import {
  composeSystemPrompt,
  SYSTEM_PROMPT_MAX_CHARS,
  UI_CONTROL_INSTRUCTIONS,
} from "../helpers";

const SAFETY_PREFIX_START = "You are a digital clone of ";

const DEFAULT_PERSONA =
  "Answer questions helpfully based on your profile information and published articles.";

// UT-02: composes in exact order with \n\n joins when all fields provided
describe("composeSystemPrompt (mirrors loadStreamingContext logic)", () => {
  it("UT-02: composes all segments in correct order joined by \\n\\n", () => {
    const result = composeSystemPrompt({
      name: "Alice",
      bio: "A writer",
      personaPrompt: "My custom persona",
      tonePreset: "friendly",
      topicsToAvoid: "politics",
    });

    const segments = result.split("\n\n");

    // Segment 0: SAFETY_PREFIX
    expect(segments[0]).toContain("digital clone of Alice");

    // Segment 1: UI-control instructions
    expect(segments[1]).toBe(UI_CONTROL_INSTRUCTIONS);

    // Segment 2: tone clause (friendly)
    expect(segments[2]).toBe(TONE_PRESETS.friendly.clause);

    // Segment 3: bio
    expect(segments[3]).toBe("Bio: A writer");

    // Segment 4: persona
    expect(segments[4]).toBe("My custom persona");

    // Segment 5: topics
    expect(segments[5]).toBe("Avoid discussing: politics");

    expect(segments).toHaveLength(6);
  });

  // UT-03: omits tone clause when tonePreset is null
  it("UT-03: omits tone clause when tonePreset is null", () => {
    const result = composeSystemPrompt({
      name: "Bob",
      bio: "A developer",
      personaPrompt: "My persona",
      tonePreset: null,
      topicsToAvoid: null,
    });

    // Should contain no clause from TONE_PRESETS
    for (const key of Object.keys(TONE_PRESETS) as TonePreset[]) {
      expect(result).not.toContain(TONE_PRESETS[key].clause);
    }

    const segments = result.split("\n\n");
    // SAFETY_PREFIX, UI control, bio, persona — no tone, no topics
    expect(segments).toHaveLength(4);
  });

  // UT-04: omits topics line when topicsToAvoid is null
  it("UT-04: omits topics line when topicsToAvoid is null", () => {
    const result = composeSystemPrompt({
      name: "Carol",
      bio: "An artist",
      personaPrompt: "Creative persona",
      tonePreset: "witty",
      topicsToAvoid: null,
    });

    expect(result).not.toContain("Avoid discussing:");
  });

  // UT-05: falls back to DEFAULT_PERSONA when personaPrompt is null
  it("UT-05: falls back to DEFAULT_PERSONA when personaPrompt is null", () => {
    const resultNull = composeSystemPrompt({
      name: "Dave",
      personaPrompt: null,
    });
    expect(resultNull).toContain(DEFAULT_PERSONA);
  });

  it("UT-05: falls back to DEFAULT_PERSONA when personaPrompt is empty string", () => {
    const resultEmpty = composeSystemPrompt({
      name: "Dave",
      personaPrompt: "",
    });
    expect(resultEmpty).toContain(DEFAULT_PERSONA);
  });

  // FR-09: SYSTEM_PROMPT_MAX_CHARS truncation
  describe("FR-09: SYSTEM_PROMPT_MAX_CHARS budget", () => {
    it("caps output at SYSTEM_PROMPT_MAX_CHARS when persona is oversize", () => {
      const hugePersona = "p".repeat(SYSTEM_PROMPT_MAX_CHARS * 2);
      const hugeBio = "b".repeat(SYSTEM_PROMPT_MAX_CHARS);
      const hugeTopics = "t".repeat(SYSTEM_PROMPT_MAX_CHARS);

      const result = composeSystemPrompt({
        name: "Alice",
        bio: hugeBio,
        personaPrompt: hugePersona,
        tonePreset: "friendly",
        topicsToAvoid: hugeTopics,
      });

      expect(result.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
    });

    it("preserves the safety-prefix substring verbatim at the start after truncation", () => {
      const hugePersona = "p".repeat(SYSTEM_PROMPT_MAX_CHARS * 2);

      const result = composeSystemPrompt({
        name: "Alice",
        bio: "b".repeat(2000),
        personaPrompt: hugePersona,
        tonePreset: "friendly",
        topicsToAvoid: "t".repeat(2000),
      });

      expect(result.startsWith(SAFETY_PREFIX_START)).toBe(true);
      expect(result).toContain("digital clone of Alice");
      // Tone clause also preserved verbatim.
      expect(result).toContain(TONE_PRESETS.friendly.clause);
    });

    it("Finding A: enormous name producing a huge safety prefix still caps at SYSTEM_PROMPT_MAX_CHARS", () => {
      // Pre-fix bug: a 6000-char name blew past 6000 because the fixed
      // sections were never truncated AND empty truncatable parts still
      // contributed separator characters.
      const hugeName = "N".repeat(SYSTEM_PROMPT_MAX_CHARS);
      const result = composeSystemPrompt({
        name: hugeName,
        bio: "short bio",
        personaPrompt: "short persona",
        tonePreset: "friendly",
        topicsToAvoid: "short topics",
      });
      expect(result.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
    });

    it("Finding A: 5500-char bio keeps FULL tone clause verbatim and stays ≤ 6000 chars", () => {
      const bigBio = "x".repeat(5500);
      const result = composeSystemPrompt({
        name: "Alice",
        bio: bigBio,
        personaPrompt: "short persona",
        tonePreset: "friendly",
        topicsToAvoid: "short topics",
      });

      expect(result.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
      // The complete, unmodified tone clause string must still appear —
      // the tone clause is load-bearing safety content and must survive
      // proportional truncation verbatim.
      expect(result).toContain(TONE_PRESETS.friendly.clause);
      // Safety prefix also preserved verbatim at the start.
      expect(result.startsWith(SAFETY_PREFIX_START)).toBe(true);
      expect(result).toContain("digital clone of Alice");
    });

    it("preserves section order (safety → UI control → tone → bio → persona → topics) when under budget", () => {
      const result = composeSystemPrompt({
        name: "Alice",
        bio: "Writer from Oakland",
        personaPrompt: "Persona body",
        tonePreset: "friendly",
        topicsToAvoid: "politics",
      });

      const safetyIdx = result.indexOf("digital clone of Alice");
      const uiControlIdx = result.indexOf(UI_CONTROL_INSTRUCTIONS);
      const toneIdx = result.indexOf(TONE_PRESETS.friendly.clause);
      const bioIdx = result.indexOf("Bio: Writer from Oakland");
      const personaIdx = result.indexOf("Persona body");
      const topicsIdx = result.indexOf("Avoid discussing: politics");

      expect(safetyIdx).toBeGreaterThanOrEqual(0);
      expect(uiControlIdx).toBeGreaterThan(safetyIdx);
      expect(toneIdx).toBeGreaterThan(uiControlIdx);
      expect(bioIdx).toBeGreaterThan(toneIdx);
      expect(personaIdx).toBeGreaterThan(bioIdx);
      expect(topicsIdx).toBeGreaterThan(personaIdx);
    });
  });
});
