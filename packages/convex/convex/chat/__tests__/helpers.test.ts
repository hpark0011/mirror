import { describe, expect, it } from "vitest";
import { TONE_PRESETS, type TonePreset } from "../tonePresets";
import {
  buildContentInventorySentence,
  composeSystemPrompt,
  STYLE_RULES,
  SYSTEM_PROMPT_MAX_CHARS,
  type ContentInventory,
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

    // Segment 1: STYLE_RULES (always present, alongside safety prefix)
    expect(segments[1]).toContain(STYLE_RULES);

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
    // SAFETY_PREFIX, STYLE_RULES, bio, persona — no tone, no topics
    expect(segments).toHaveLength(4);
    expect(segments[1]).toContain(STYLE_RULES);
  });

  it("always includes STYLE_RULES even when persona is custom and no tone is set", () => {
    // STYLE_RULES is product-wide: the chat UI renders plain text, so this
    // clause must survive every combination of persona/tone/topics.
    const result = composeSystemPrompt({
      name: "Eve",
      personaPrompt: "Custom persona that does not mention formatting",
      tonePreset: null,
      topicsToAvoid: null,
    });

    expect(result).toContain(STYLE_RULES);
  });

  it("includes STYLE_RULES on the truly-minimal call (only name, all other fields omitted)", () => {
    // Boundary: if a future change ever conditionally gates STYLE_RULES on
    // a field being present, this test catches the regression.
    const result = composeSystemPrompt({ name: "Frank" });
    expect(result).toContain(STYLE_RULES);
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
      // STYLE_RULES is in the fixed array and the name cap (MAX_NAME_CHARS)
      // ensures the safety prefix never starves the budget — so the style
      // clause must survive verbatim even in the pathological-name path.
      expect(result).toContain(STYLE_RULES);
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
      // STYLE_RULES is in the same fixed (non-truncatable) array as the tone
      // clause, so it must also survive proportional truncation verbatim.
      expect(result).toContain(STYLE_RULES);
      // Safety prefix also preserved verbatim at the start.
      expect(result.startsWith(SAFETY_PREFIX_START)).toBe(true);
      expect(result).toContain("digital clone of Alice");
    });

    it("preserves section order (safety → style → tone → bio → persona → topics) when under budget", () => {
      const result = composeSystemPrompt({
        name: "Alice",
        bio: "Writer from Oakland",
        personaPrompt: "Persona body",
        tonePreset: "friendly",
        topicsToAvoid: "politics",
      });

      const safetyIdx = result.indexOf("digital clone of Alice");
      const styleIdx = result.indexOf(STYLE_RULES);
      const toneIdx = result.indexOf(TONE_PRESETS.friendly.clause);
      const bioIdx = result.indexOf("Bio: Writer from Oakland");
      const personaIdx = result.indexOf("Persona body");
      const topicsIdx = result.indexOf("Avoid discussing: politics");

      expect(safetyIdx).toBeGreaterThanOrEqual(0);
      expect(styleIdx).toBeGreaterThan(safetyIdx);
      expect(toneIdx).toBeGreaterThan(styleIdx);
      expect(bioIdx).toBeGreaterThan(toneIdx);
      expect(personaIdx).toBeGreaterThan(bioIdx);
      expect(topicsIdx).toBeGreaterThan(personaIdx);
    });
  });

  // FG_124: contentInventory section
  describe("contentInventory (FG_124: clone declares structured content kinds)", () => {
    const allFalse: ContentInventory = {
      articles: false,
      posts: false,
      bioEntries: false,
    };

    it("includes the 'bio entries' phrase when contentInventory.bioEntries is true", () => {
      const result = composeSystemPrompt({
        name: "Alice",
        contentInventory: { ...allFalse, bioEntries: true },
      });

      // The phrase "bio entries" must appear so the agent has proactive
      // vocabulary for the noun, not only when the visitor's message
      // lexically matches retrieval.
      expect(result).toContain("bio entries");
    });

    it("does NOT include the 'bio entries' phrase when contentInventory.bioEntries is false", () => {
      const result = composeSystemPrompt({
        name: "Alice",
        contentInventory: allFalse,
      });

      expect(result).not.toContain("bio entries");
    });

    it("omits the inventory sentence entirely when no kinds are populated", () => {
      const result = composeSystemPrompt({
        name: "Alice",
        contentInventory: allFalse,
      });

      // No kinds → no "You can speak from this person's …" sentence at all,
      // preserving prompt shape for users with no structured content.
      expect(result).not.toContain("You can speak from this person's");
    });

    it("omits the inventory sentence when contentInventory is undefined (backward compat)", () => {
      const result = composeSystemPrompt({ name: "Alice" });
      expect(result).not.toContain("You can speak from this person's");
    });

    it("lists only populated kinds — bio + posts but not articles", () => {
      // Override personaPrompt because DEFAULT_PERSONA itself contains the
      // phrase "published articles" — we need to assert on the inventory
      // sentence specifically, not the surrounding prompt.
      const result = composeSystemPrompt({
        name: "Alice",
        personaPrompt: "Custom persona text without article keywords.",
        contentInventory: { articles: false, posts: true, bioEntries: true },
      });

      // Inventory sentence appears verbatim with the populated kinds joined
      // and an "and" before the last item.
      expect(result).toContain(
        "You can speak from this person's bio entries (work history, education) and published posts when relevant.",
      );
      // The omitted kind is not in the inventory sentence — the persona was
      // overridden so any remaining "published articles" substring would
      // come from the inventory section we're testing against.
      expect(result).not.toContain("published articles");
    });

    it("places the inventory sentence in the truncatable region (after topics)", () => {
      const result = composeSystemPrompt({
        name: "Alice",
        bio: "Writer",
        personaPrompt: "Persona body",
        tonePreset: "friendly",
        topicsToAvoid: "politics",
        contentInventory: { articles: true, posts: true, bioEntries: true },
      });

      const topicsIdx = result.indexOf("Avoid discussing: politics");
      const inventoryIdx = result.indexOf("You can speak from this person's");

      expect(topicsIdx).toBeGreaterThanOrEqual(0);
      expect(inventoryIdx).toBeGreaterThan(topicsIdx);
    });

    it("phrasing is plain conversational prose (no markdown / lists / headers)", () => {
      const sentence = buildContentInventorySentence({
        articles: true,
        posts: true,
        bioEntries: true,
      });

      // STYLE_RULES forbids **, *, _, backticks, bullets, headers — the
      // inventory sentence must not introduce any of those markers.
      expect(sentence).not.toBeNull();
      expect(sentence!).not.toMatch(/\*\*|\*[^*]|_[^_]|`/);
      expect(sentence!).not.toMatch(/^\s*[-•]/m);
      expect(sentence!).not.toMatch(/^#/m);
    });

    it("buildContentInventorySentence returns null when nothing populated", () => {
      expect(buildContentInventorySentence(allFalse)).toBeNull();
    });

    it("FR-09 truncation budget still holds with full inventory + oversize fields", () => {
      // Confirms acceptance criterion: the existing truncation logic still
      // enforces SYSTEM_PROMPT_MAX_CHARS even when contentInventory pushes
      // the truncatable list to its longest plausible shape.
      const hugePersona = "p".repeat(SYSTEM_PROMPT_MAX_CHARS * 2);
      const hugeBio = "b".repeat(SYSTEM_PROMPT_MAX_CHARS);
      const hugeTopics = "t".repeat(SYSTEM_PROMPT_MAX_CHARS);

      const result = composeSystemPrompt({
        name: "Alice",
        bio: hugeBio,
        personaPrompt: hugePersona,
        tonePreset: "friendly",
        topicsToAvoid: hugeTopics,
        contentInventory: { articles: true, posts: true, bioEntries: true },
      });

      expect(result.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
      // Fixed sections still survive proportional truncation verbatim.
      expect(result).toContain(STYLE_RULES);
      expect(result).toContain(TONE_PRESETS.friendly.clause);
    });
  });
});
