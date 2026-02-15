"use client";

import { useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { cn } from "@feel-good/utils/cn";
import { createArticleExtensions } from "../lib/extensions";
import { sanitizeContent } from "../lib/sanitize-content";

const ARTICLE_EXTENSIONS = createArticleExtensions();

type RichTextViewerProps = {
  content: JSONContent;
  className?: string;
};

export function RichTextViewer({ content, className }: RichTextViewerProps) {
  const safeContent = useMemo(() => sanitizeContent(content), [content]);

  const editor = useEditor({
    extensions: ARTICLE_EXTENSIONS,
    content: safeContent,
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && safeContent) {
      editor.commands.setContent(safeContent);
    }
  }, [editor, safeContent]);

  if (!editor) {
    return (
      <div
        className={cn(
          "tiptap-content prose dark:prose-invert max-w-none min-h-[200px]",
          className,
        )}
      />
    );
  }

  return (
    <EditorContent
      editor={editor}
      className={cn(
        "tiptap-content prose dark:prose-invert max-w-none",
        className,
      )}
    />
  );
}
