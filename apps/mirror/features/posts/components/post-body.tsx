"use client";

import dynamic from "next/dynamic";
import { type JSONContent } from "@tiptap/core";
import { cn } from "@feel-good/utils/cn";

// Single post-body renderer for both the list row and the detail page.
// Posts render through the faithful Tiptap viewer everywhere so headings,
// lists, blockquotes, and code survive — the list previously used a lossy
// JSONContent->React mapper that flattened them to paragraphs. Loaded
// client-side only (Tiptap has no SSR path here).
const RichTextViewer = dynamic(
  () =>
    import("@feel-good/features/editor/components").then(
      (m) => m.RichTextViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="prose dark:prose-invert max-w-none min-h-[200px]" />
    ),
  },
);

type PostBodyProps = {
  content: JSONContent;
  /**
   * True when the post has no title. The body must then top-align with the
   * left metadata column. The first paragraph's 1rem top margin comes from
   * `.tiptap-content .tiptap p` in tiptap-content.css and can't be reset by
   * a Tailwind arbitrary variant (the `<p>` is nested two levels under the
   * class node, and Tailwind v4 won't compile a `[&_.ProseMirror>*…]`
   * descendant-combinator variant anyway). The `tiptap-flush-top` class
   * opts into a deterministic rule defined alongside that margin in
   * tiptap-content.css.
   */
  titleless: boolean;
};

export function PostBody({ content, titleless }: PostBodyProps) {
  return (
    <RichTextViewer
      content={content}
      className={cn(
        "max-w-xl text-[17px] leading-[1.3] font-regular space-y-2 [&_img]:my-3 mt-0 tracking-[-0.04em]",
        titleless && "tiptap-flush-top",
      )}
    />
  );
}
