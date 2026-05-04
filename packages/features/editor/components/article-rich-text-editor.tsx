"use client";

// Article editor host. Mirrors the role `RichTextEditor` plays for posts but
// composes the greyboard-style affordances on top:
//   - the StarterKit + Placeholder + Image + Link + SlashCommand stack
//   - a `<TextBubbleMenu>` over the contenteditable
//   - the inline-image upload pipeline (paste/drop) reused from the existing
//     `inline-image-upload-plugin`
//   - a render-prop `renderToolbar({ editor })` so the host can portal the
//     fixed toolbar into the workspace toolbar slot — the editor instance
//     lives here, but the toolbar can render anywhere
import { type Extensions, type JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { cn } from "@feel-good/utils/cn";
import { createArticleEditorExtensions } from "../lib/article-editor-extensions";
import {
  createInlineImageUploadExtension,
  hasPendingUploads,
  type InlineImageUploadResult,
} from "../lib/inline-image-upload-plugin";
import { TextBubbleMenu } from "./text-bubble-menu";

type ArticleRichTextEditorProps = {
  content: JSONContent;
  onChange: (next: JSONContent) => void;
  /** Inline-image upload pipeline used by paste, drop, and the slash-menu Image item. */
  onImageUpload: (file: File) => Promise<InlineImageUploadResult>;
  onPendingUploadsChange?: (hasPending: boolean) => void;
  onImageUploadError?: (err: unknown) => void;
  className?: string;
  placeholder?: string;
  /**
   * Render-prop for the fixed toolbar. The host typically portals the
   * returned tree into the workspace toolbar slot. Returning `null` means
   * the editor mounts without a fixed toolbar.
   */
  renderToolbar?: (args: {
    editor: NonNullable<ReturnType<typeof useEditor>>;
    pickInlineImage: () => Promise<{ src: string } | null>;
  }) => ReactNode;
};

export function ArticleRichTextEditor({
  content,
  onChange,
  onImageUpload,
  onPendingUploadsChange,
  onImageUploadError,
  className,
  placeholder,
  renderToolbar,
}: ArticleRichTextEditorProps) {
  // Keep handlers in refs so the long-lived editor instance always reads the
  // latest closures even if the parent re-renders.
  const onImageUploadRef = useRef(onImageUpload);
  useEffect(() => {
    onImageUploadRef.current = onImageUpload;
  }, [onImageUpload]);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const onPendingUploadsChangeRef = useRef(onPendingUploadsChange);
  useEffect(() => {
    onPendingUploadsChangeRef.current = onPendingUploadsChange;
  }, [onPendingUploadsChange]);
  const onImageUploadErrorRef = useRef(onImageUploadError);
  useEffect(() => {
    onImageUploadErrorRef.current = onImageUploadError;
  }, [onImageUploadError]);

  const lastPendingRef = useRef(false);

  // Slash-menu Image picker reuses the same upload pipeline that paste/drop
  // already use; we open a hidden file input on demand.
  const pickInlineImage = useMemo(
    () => async (): Promise<{ src: string } | null> => {
      const file = await new Promise<File | null>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          resolve(input.files?.[0] ?? null);
        };
        input.click();
      });
      if (!file) return null;
      try {
        const result = await onImageUploadRef.current(file);
        return { src: result.url };
      } catch (err) {
        onImageUploadErrorRef.current?.(err);
        return null;
      }
    },
    [],
  );

  const extensions = useMemo<Extensions>(
    () => [
      ...createArticleEditorExtensions({
        placeholder,
        slash: {
          pickInlineImage,
          onError: (msg) => onImageUploadErrorRef.current?.(new Error(msg)),
        },
      }),
      createInlineImageUploadExtension({
        onUpload: (file) => onImageUploadRef.current(file),
        onError: (err) => onImageUploadErrorRef.current?.(err),
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
    editorProps: {
      attributes: { class: "tiptap" },
    },
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(instance.getJSON());
    },
    onTransaction: ({ editor: instance }) => {
      const next = hasPendingUploads(instance.state);
      if (next !== lastPendingRef.current) {
        lastPendingRef.current = next;
        onPendingUploadsChangeRef.current?.(next);
      }
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
    <>
      {renderToolbar?.({ editor, pickInlineImage })}
      <EditorContent
        editor={editor}
        className={cn(
          "tiptap-content prose dark:prose-invert max-w-none",
          className,
        )}
      />
      <TextBubbleMenu editor={editor} />
    </>
  );
}
