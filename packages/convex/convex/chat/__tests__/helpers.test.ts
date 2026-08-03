import { describe, expect, it } from "vitest";
import {
  buildContentInventorySentence,
  composeSystemPrompt,
  STYLE_RULES,
  SYSTEM_PROMPT_MAX_CHARS,
  type ContentInventory,
} from "../helpers";

const EMPTY_INVENTORY: ContentInventory = {
  articles: false,
  posts: false,
  bioEntries: false,
  contactEntries: false,
  projects: false,
};

describe("composeSystemPrompt", () => {
  it("uses one fixed public-chat contract", () => {
    const prompt = composeSystemPrompt({
      name: "Alice",
      tagline: "A writer",
    });

    expect(prompt).toContain("digital clone of Alice");
    expect(prompt).toContain(STYLE_RULES);
    expect(prompt).toContain("Tagline: A writer");
    expect(prompt).toContain(
      "Answer questions helpfully based on your profile information and published articles.",
    );
    expect(prompt).toContain("findRelevantPublishedContent");
    expect(prompt).toContain("navigateToContent");
    expect(prompt).toContain("openProfileSection");
  });

  it("only exposes owner-write vocabulary to the profile owner", () => {
    const visitorPrompt = composeSystemPrompt({ name: "Alice" });
    const ownerPrompt = composeSystemPrompt({
      name: "Alice",
      canUseOwnerWriteTools: true,
    });

    expect(visitorPrompt).not.toContain("publishPost");
    expect(visitorPrompt).not.toContain("deleteArticle");
    expect(ownerPrompt).toContain("publishPost");
    expect(ownerPrompt).toContain("unpublishPost");
    expect(ownerPrompt).toContain("publishArticle");
    expect(ownerPrompt).toContain("deleteArticle");
  });

  it("keeps fixed safety and tool instructions inside the prompt budget", () => {
    const prompt = composeSystemPrompt({
      name: "N".repeat(SYSTEM_PROMPT_MAX_CHARS),
      tagline: "T".repeat(SYSTEM_PROMPT_MAX_CHARS * 2),
      contentInventory: {
        articles: true,
        posts: true,
        bioEntries: true,
        contactEntries: true,
        projects: true,
      },
    });

    expect(prompt.length).toBeLessThanOrEqual(SYSTEM_PROMPT_MAX_CHARS);
    expect(prompt).toContain(STYLE_RULES);
    expect(prompt).toContain("navigateToContent");
    expect(prompt).toContain("findRelevantPublishedContent");
  });
});

describe("buildContentInventorySentence", () => {
  it("returns null when the profile has no structured content", () => {
    expect(buildContentInventorySentence(EMPTY_INVENTORY)).toBeNull();
  });

  it("lists only populated content kinds in conversational prose", () => {
    const sentence = buildContentInventorySentence({
      ...EMPTY_INVENTORY,
      bioEntries: true,
      contactEntries: true,
      posts: true,
    });

    expect(sentence).toBe(
      "You can speak from this person's bio entries (work history, education), contact details (email and social links), and published posts when relevant.",
    );
    expect(sentence).not.toMatch(/^\s*[-#•]/m);
    expect(sentence).not.toMatch(/\*\*|`/);
  });

  it("places populated inventory after the fixed public instructions", () => {
    const prompt = composeSystemPrompt({
      name: "Alice",
      contentInventory: { ...EMPTY_INVENTORY, projects: true },
    });

    expect(prompt.indexOf("Answer questions helpfully")).toBeLessThan(
      prompt.indexOf("You can speak from this person's projects"),
    );
  });
});
