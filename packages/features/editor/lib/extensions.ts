import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import type { Extensions } from "@tiptap/core";
import { createInlineImageExtension } from "./inline-image-extension";

export function createArticleExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
    }),
    createInlineImageExtension(),
    Link.configure({
      openOnClick: true,
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      },
    }),
  ];
}

export function createMarkdownExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    createInlineImageExtension(),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: "noopener noreferrer nofollow",
      },
    }),
    Markdown.configure({
      html: false,
    }),
  ];
}
