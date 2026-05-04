"use client";

// Fixed-position formatting toolbar. Reads `editor.state` on every render so
// `data-active` reflects the current caret context (when the editor's
// `selectionUpdate`/`transaction` events tick the host).
//
// Designed to be portaled into the workspace toolbar slot by the host.
import {
  ArrowBackwardIcon,
  ArrowForwardIcon,
  MinusSmallIcon,
  PhotoFillIcon,
} from "@feel-good/icons";
import type { Editor } from "@tiptap/react";
import {
  BLOCK_FORMAT_ACTIONS,
  LIST_FORMAT_ACTIONS,
} from "./toolbar/format-actions";
import { TextStylePicker } from "./toolbar/text-style-picker";
import { ToolbarButton } from "./toolbar/toolbar-button";
import { ToolbarSeparator } from "./toolbar/toolbar-separator";

interface EditorFixedToolbarProps {
  editor: Editor;
  /** Optional handler to insert an inline image via the app's upload flow. */
  onInsertImage?: () => Promise<{ src: string } | null>;
  /** Optional callback to surface upload errors as a toast. */
  onError?: (message: string) => void;
}

export function EditorFixedToolbar({
  editor,
  onInsertImage,
  onError,
}: EditorFixedToolbarProps) {
  async function handleInsertImage() {
    if (!onInsertImage) return;
    try {
      const result = await onInsertImage();
      if (!result) return;
      if (editor.isDestroyed) return;
      editor.chain().focus().setImage({ src: result.src }).run();
    } catch (error) {
      onError?.(`Failed to insert image: ${(error as Error).message}`);
    }
  }

  return (
    <div
      className="tiptap-toolbar"
      data-testid="article-editor-fixed-toolbar"
      role="toolbar"
      aria-label="Article formatting"
    >
      <ToolbarButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <ArrowBackwardIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <ArrowForwardIcon className="size-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      <TextStylePicker editor={editor} />

      <ToolbarSeparator />

      {LIST_FORMAT_ACTIONS.map((action) => (
        <ToolbarButton
          key={action.key}
          label={action.label}
          onClick={() => action.command(editor)}
          isActive={action.isActive(editor)}
        >
          <action.icon className="size-4" />
        </ToolbarButton>
      ))}

      <ToolbarSeparator />

      {BLOCK_FORMAT_ACTIONS.map((action) => (
        <ToolbarButton
          key={action.key}
          label={action.label}
          onClick={() => action.command(editor)}
          isActive={action.isActive(editor)}
        >
          <action.icon className="size-4" />
        </ToolbarButton>
      ))}
      <ToolbarButton
        label="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <MinusSmallIcon className="size-4" />
      </ToolbarButton>

      {onInsertImage && (
        <>
          <ToolbarSeparator />
          <ToolbarButton label="Insert image" onClick={handleInsertImage}>
            <PhotoFillIcon className="size-4" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
