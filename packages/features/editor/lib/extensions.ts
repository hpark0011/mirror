import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import type { Extensions } from "@tiptap/core";

export function createArticleExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
    }),
    Image.configure({
      inline: false,
      HTMLAttributes: {
        loading: "lazy",
      },
    }),
    Link.configure({
      openOnClick: true,
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      },
    }),
  ];
}
