// Pins the slash-command items list shape so a refactor that drops a group,
// renames an item, or reorders the menu is caught by a unit test instead of
// a flaky e2e. Mirrors the greyboard editor's slash menu (Text / Lists /
// Blocks groups) per the planning doc.
import { describe, expect, it, vi } from "vitest";
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

  it("includes Bullet/Numbered under the Lists group", () => {
    const lists = items.filter((i) => i.group === "Lists").map((i) => i.title);
    expect(lists).toEqual(
      expect.arrayContaining(["Bullet List", "Numbered List"]),
    );
    // Task List is intentionally absent — the task-list Tiptap extensions
    // are not registered in createArticleEditorExtensions, so listing it
    // would surface as a no-op in the slash menu.
    expect(lists).not.toContain("Task List");
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

describe("Image command error normalization (FG_138)", () => {
  // Verifies that a non-Error rejection (plain string throw) produces a
  // meaningful onError message instead of "Failed to insert image: undefined".
  it("surfaces a string rejection as the literal string, not 'undefined'", async () => {
    const onError = vi.fn();
    const pickInlineImage = vi
      .fn()
      .mockRejectedValue("Upload quota exceeded");

    const commandItems = buildSlashCommandItems({ pickInlineImage, onError });
    const imageItem = commandItems.find((i) => i.title === "Image");
    expect(imageItem).toBeDefined();

    // Minimal editor stub: storage.slashCommand.isPickerOpen must be readable
    // and writable so the guard path works without a real Tiptap instance.
    const storage = { slashCommand: { isPickerOpen: false } };
    const editorStub = {
      storage,
      isDestroyed: false,
      chain: () => ({
        focus: () => ({ deleteRange: () => ({ run: () => undefined }) }),
      }),
    } as unknown as Parameters<typeof imageItem.command>[0];

    imageItem!.command(editorStub, { from: 0, to: 1 });

    // The IIFE is async — wait a tick so the catch runs.
    await new Promise((r) => setTimeout(r, 0));

    expect(onError).toHaveBeenCalledOnce();
    const [msg] = onError.mock.calls[0] as [string];
    expect(msg).toContain("Upload quota exceeded");
    expect(msg).not.toContain("undefined");
  });
});
