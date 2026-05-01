"use client";

import { useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { type Extensions, type JSONContent } from "@tiptap/core";
import { cn } from "@feel-good/utils/cn";
import { createArticleExtensions } from "../lib/extensions";
import {
  createInlineImageUploadExtension,
  type InlineImageUploadResult,
} from "../lib/inline-image-upload-plugin";

type RichTextEditorProps = {
  content: JSONContent;
  onChange: (next: JSONContent) => void;
  onImageUpload: (file: File) => Promise<InlineImageUploadResult>;
  className?: string;
};

export function RichTextEditor({
  content,
  onChange,
  onImageUpload,
  className,
}: RichTextEditorProps) {
  // Ref-forwarding pattern: extensions are constructed once (the editor is a
  // single long-lived instance), but uploads always invoke the LATEST
  // `onImageUpload` reference. Without this, a parent re-render that swaps
  // the upload handler (e.g. refreshed auth context) would silently keep
  // calling the stale function captured at mount time.
  const onImageUploadRef = useRef(onImageUpload);
  useEffect(() => {
    onImageUploadRef.current = onImageUpload;
  }, [onImageUpload]);

  const extensions = useMemo<Extensions>(
    () => [
      ...createArticleExtensions(),
      createInlineImageUploadExtension({
        onUpload: (file) => onImageUploadRef.current(file),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content,
    editable: true,
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON());
    },
  });

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
