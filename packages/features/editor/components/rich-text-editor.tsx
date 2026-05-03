"use client";

import { useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { type Extensions, type JSONContent } from "@tiptap/core";
import { cn } from "@feel-good/utils/cn";
import { createArticleExtensions } from "../lib/extensions";
import {
  createInlineImageUploadExtension,
  hasPendingUploads,
  type InlineImageUploadResult,
} from "../lib/inline-image-upload-plugin";

type RichTextEditorProps = {
  content: JSONContent;
  onChange: (next: JSONContent) => void;
  onImageUpload: (file: File) => Promise<InlineImageUploadResult>;
  /**
   * Fires when the inline-image upload placeholder count crosses the
   * empty/non-empty boundary. Hosts use this to gate Save while uploads are
   * in flight (FG_092). Boolean is dedup'd against the previous emission.
   */
  onPendingUploadsChange?: (hasPending: boolean) => void;
  /**
   * Fires when `onImageUpload` rejects for any reason — validation errors
   * (`InlineImageValidationError`) or network/server failures. Hosts wire
   * this to a toast so a failed paste/drop surfaces visibly instead of
   * just removing the placeholder silently (FG_113).
   */
  onImageUploadError?: (err: unknown) => void;
  className?: string;
  /**
   * Factory for the base Tiptap extensions. Defaults to
   * `createArticleExtensions` so existing callers keep their behavior. The
   * inline-image-upload extension is always appended on top so it retains
   * its closure over `onImageUploadRef` (FG_105).
   */
  extensions?: () => Extensions;
};

export function RichTextEditor({
  content,
  onChange,
  onImageUpload,
  onPendingUploadsChange,
  onImageUploadError,
  className,
  extensions: extensionsFactory = createArticleExtensions,
}: RichTextEditorProps) {
  // Ref-forwarding pattern: extensions and the `onUpdate` callback are
  // constructed once (the editor is a single long-lived instance), but
  // they always invoke the LATEST `onImageUpload` / `onChange` references.
  // Without this, a parent re-render that swaps either handler would
  // silently keep calling the stale function captured at mount time.
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

  // Tracks the most recently emitted boolean so we only call the host
  // when the placeholder count crosses the empty/non-empty boundary —
  // every transaction fires `onTransaction`, but the host only cares
  // about state transitions.
  const lastPendingRef = useRef(false);

  const extensions = useMemo<Extensions>(
    () => [
      ...extensionsFactory(),
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
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(instance.getJSON());
    },
    onTransaction: ({ editor: instance }) => {
      // `onTransaction` fires for both doc-changing and meta-only
      // transactions (the placeholder add/remove uses `setMeta`). Reading
      // `hasPendingUploads` here is the only way to observe the
      // DecorationSet flip — `onUpdate` would miss meta-only events.
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
    <EditorContent
      editor={editor}
      className={cn(
        "tiptap-content prose dark:prose-invert max-w-none",
        className,
      )}
    />
  );
}
