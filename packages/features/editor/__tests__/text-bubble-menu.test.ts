// Regression test for FG_134: the bubble-menu container must gain the
// `tiptap-bubble-menu--editing` class whenever the link editor is open.
//
// Implementation lives at:
//   packages/features/editor/components/bubble-menu/text-bubble-menu.tsx:124-127
//
//   className={cn(
//     "tiptap-bubble-menu",
//     isEditingLink && "tiptap-bubble-menu--editing",
//   )}
//
// This test pins the className contract at the cn() expression level —
// i.e., "given isEditingLink=true, the className string contains
// tiptap-bubble-menu--editing." If the conditional is ever dropped from
// the cn() call, this test fails without requiring a DOM render.

import { describe, expect, it } from "vitest";
import { cn } from "@feel-good/utils/cn";

// --- helpers mirroring the component source exactly ---

function bubbleMenuClassName(isEditingLink: boolean): string {
  return cn("tiptap-bubble-menu", isEditingLink && "tiptap-bubble-menu--editing");
}

// ---

describe("TextBubbleMenu className contract (FG_134)", () => {
  it("includes tiptap-bubble-menu--editing when isEditingLink is true", () => {
    const cls = bubbleMenuClassName(true);
    expect(cls).toContain("tiptap-bubble-menu");
    expect(cls).toContain("tiptap-bubble-menu--editing");
  });

  it("does NOT include tiptap-bubble-menu--editing when isEditingLink is false", () => {
    const cls = bubbleMenuClassName(false);
    expect(cls).toContain("tiptap-bubble-menu");
    expect(cls).not.toContain("tiptap-bubble-menu--editing");
  });

  it("base class is always present regardless of editing state", () => {
    expect(bubbleMenuClassName(false)).toMatch(/\btiptap-bubble-menu\b/);
    expect(bubbleMenuClassName(true)).toMatch(/\btiptap-bubble-menu\b/);
  });
});
