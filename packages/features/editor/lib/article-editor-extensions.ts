// Tiptap extension stack for the article editor (greyboard parity).
//
// Differences from `createArticleExtensions` (the existing minimal stack
// used by posts):
//   - StarterKit: enables h1–h3 (vs h2–h4) so slash menu Heading 1 is real
//   - Adds Placeholder so an empty editor shows "Start writing or press '/'"
//   - Adds the slash command extension (caller wires `pickInlineImage`)
//   - Keeps the same `createInlineImageExtension()` and the same Link config
//
// Markdown extension is intentionally NOT included — Mirror articles store
// `JSONContent`, not markdown.
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/core";
import {
  SlashCommand,
  type SlashCommandOptions,
} from "../extensions/slash-command";
import { createInlineImageExtension } from "./inline-image-extension";

interface CreateArticleEditorExtensionsOptions {
  placeholder?: string;
  slash?: SlashCommandOptions;
}

export function createArticleEditorExtensions(
  options: CreateArticleEditorExtensionsOptions = {},
): Extensions {
  const {
    placeholder = "Start writing or press '/' for commands",
    slash = {},
  } = options;
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({ placeholder }),
    createInlineImageExtension(),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      },
    }),
    SlashCommand.configure(slash),
  ];
}
