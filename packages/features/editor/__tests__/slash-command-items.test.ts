// Pins the slash-command items list shape so a refactor that drops a group,
// renames an item, or reorders the menu is caught by a unit test instead of
// a flaky e2e. Mirrors the greyboard editor's slash menu (Text / Lists /
// Blocks groups) per the planning doc.
import { describe, expect, it } from "vitest";
import {
  buildSlashCommandItems,
  filterSlashCommandItems,
} from "../extensions/slash-command";

describe("buildSlashCommandItems", () => {
  const items = buildSlashCommandItems();

  it("includes paragraph + heading levels under the Text group", () => {
    const text = items.filter((i) => i.group === "Text");
    const titles = text.map((i) => i.title);
    expect(titles).toEqual(
      expect.arrayContaining(["Text", "Heading 1", "Heading 2", "Heading 3"]),
    );
    // Heading order: 1 → 2 → 3
    const h1 = titles.indexOf("Heading 1");
    const h2 = titles.indexOf("Heading 2");
    const h3 = titles.indexOf("Heading 3");
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(h1).toBeLessThan(h2);
    expect(h2).toBeLessThan(h3);
  });

  it("includes Bullet/Numbered/Task under the Lists group", () => {
    const lists = items.filter((i) => i.group === "Lists").map((i) => i.title);
    expect(lists).toEqual(
      expect.arrayContaining(["Bullet List", "Numbered List", "Task List"]),
    );
  });

  it("includes Code Block, Blockquote, Divider, Image under Blocks", () => {
    const blocks = items.filter((i) => i.group === "Blocks").map((i) => i.title);
    expect(blocks).toEqual(
      expect.arrayContaining([
        "Code Block",
        "Blockquote",
        "Divider",
        "Image",
      ]),
    );
  });

  it("every item carries a non-empty title, group, keyword list, and command callable", () => {
    for (const item of items) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.group.length).toBeGreaterThan(0);
      expect(Array.isArray(item.keywords)).toBe(true);
      expect(item.keywords.length).toBeGreaterThan(0);
      expect(typeof item.command).toBe("function");
    }
  });

  it("filters case-insensitively against title and keyword list", () => {
    const head = filterSlashCommandItems(items, "HEAD");
    expect(head.map((i) => i.title)).toEqual(
      expect.arrayContaining(["Heading 1", "Heading 2", "Heading 3"]),
    );

    const ul = filterSlashCommandItems(items, "ul");
    expect(ul.map((i) => i.title)).toContain("Bullet List");
  });
});
