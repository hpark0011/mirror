// Slash command extension — typing "/" at the start of an empty paragraph
// (or after another empty paragraph) opens the slash menu, which is rendered
// by `SlashCommandMenu` via `createSuggestionRenderer`. Items + their commands
// live as plain data so unit tests can assert the list shape directly.
//
// Ported from greyboard/packages/features/editor/src/extensions/slash-command.ts.
import {
  CheckListIcon,
  CodeIcon,
  ListBulletIcon,
  ListNumberIcon,
  MinusSmallIcon,
  PhotoFillIcon,
  QuoteOpeningIcon,
  TextFormatIcon,
  TextFormatSizeLargerIcon,
} from "@feel-good/icons";
import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import type { ComponentType } from "react";

import { SlashCommandMenu } from "../components/slash-command-menu";
import { createSuggestionRenderer } from "../utils/suggestion-popup";

export interface SlashCommandItem {
  title: string;
  icon: ComponentType<{ className?: string }>;
  keywords: string[];
  group: string;
  command: (
    editor: Editor,
    range: { from: number; to: number },
  ) => void;
}

export interface SlashCommandOptions {
  /**
   * If supplied, the "Image" item runs this picker. The picker should resolve
   * to a `{ src }` to insert (typically the URL the inline-image upload
   * pipeline returned), or `null` to abort.
   */
  pickInlineImage?: () => Promise<{ src: string } | null>;
  onError?: (message: string) => void;
}

let isPickerOpen = false;

export function buildSlashCommandItems(
  options: SlashCommandOptions = {},
): SlashCommandItem[] {
  const { pickInlineImage, onError } = options;
  return [
    {
      title: "Text",
      icon: TextFormatIcon,
      keywords: ["paragraph", "plain", "normal"],
      group: "Text",
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "Heading 1",
      icon: TextFormatSizeLargerIcon,
      keywords: ["h1", "title", "heading"],
      group: "Text",
      command: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHeading({ level: 1 })
          .run();
      },
    },
    {
      title: "Heading 2",
      icon: TextFormatSizeLargerIcon,
      keywords: ["h2", "subtitle", "heading"],
      group: "Text",
      command: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHeading({ level: 2 })
          .run();
      },
    },
    {
      title: "Heading 3",
      icon: TextFormatSizeLargerIcon,
      keywords: ["h3", "heading"],
      group: "Text",
      command: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHeading({ level: 3 })
          .run();
      },
    },
    {
      title: "Bullet List",
      icon: ListBulletIcon,
      keywords: ["unordered", "ul", "list"],
      group: "Lists",
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered List",
      icon: ListNumberIcon,
      keywords: ["ordered", "ol", "list"],
      group: "Lists",
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "Task List",
      icon: CheckListIcon,
      keywords: ["todo", "checkbox", "checklist"],
      group: "Lists",
      command: (editor, range) => {
        // StarterKit doesn't ship task lists; treat as a no-op when the
        // extension isn't loaded so the slash menu list stays parity-clean
        // with greyboard. The unit-test suite only inspects the menu shape.
        if (
          (
            editor.commands as {
              toggleTaskList?: () => boolean;
            }
          ).toggleTaskList
        ) {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleTaskList()
            .run();
        } else {
          editor.chain().focus().deleteRange(range).run();
        }
      },
    },
    {
      title: "Code Block",
      icon: CodeIcon,
      keywords: ["code", "pre", "snippet"],
      group: "Blocks",
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "Blockquote",
      icon: QuoteOpeningIcon,
      keywords: ["quote"],
      group: "Blocks",
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "Divider",
      icon: MinusSmallIcon,
      keywords: ["hr", "separator", "line"],
      group: "Blocks",
      command: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: "Image",
      icon: PhotoFillIcon,
      keywords: ["photo", "picture"],
      group: "Blocks",
      command: (editor, range) => {
        if (!pickInlineImage) {
          onError?.("Image picker not configured");
          return;
        }
        if (isPickerOpen) return;
        editor.chain().focus().deleteRange(range).run();
        (async () => {
          isPickerOpen = true;
          try {
            const result = await pickInlineImage();
            if (!result) return;
            if (editor.isDestroyed) return;
            editor.chain().focus().setImage({ src: result.src }).run();
          } catch (error) {
            onError?.(
              `Failed to insert image: ${(error as Error).message}`,
            );
          } finally {
            isPickerOpen = false;
          }
        })();
      },
    },
  ];
}

export function filterSlashCommandItems(
  items: SlashCommandItem[],
  query: string,
): SlashCommandItem[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => {
    if (item.title.toLowerCase().startsWith(lower)) return true;
    return item.keywords.some((kw) => kw.startsWith(lower));
  });
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {};
  },

  addProseMirrorPlugins() {
    const items = buildSlashCommandItems(this.options);
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: "/",
        pluginKey: new PluginKey("slashCommand"),
        items: ({ query }) => filterSlashCommandItems(items, query),
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name === "codeBlock") return false;
          const textBefore = $from.parent.textBetween(
            0,
            $from.parentOffset,
            undefined,
            "￼",
          );
          const beforeSlash = textBefore.slice(0, -1);
          return beforeSlash.trim() === "";
        },
        command: ({ editor, range, props: item }) => {
          item.command(editor, range);
        },
        render: createSuggestionRenderer(SlashCommandMenu),
      }),
    ];
  },
});
