"use client";

// Floating menu that appears over a non-empty text selection. Uses the
// `BubbleMenu` from @tiptap/react/menus so positioning, repositioning on
// scroll, and lifecycle (selection ↓/↑) are handled by Tiptap.
//
// Hidden when the selection is empty, not a TextSelection, sits inside an
// image / inline-math node, or inside a code block.
import { LinkIcon } from "@feel-good/icons";
import { Input } from "@feel-good/ui/primitives/input";
import { cn } from "@feel-good/utils/cn";
import { type EditorState, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FormatGroup } from "../toolbar/format-group";
import { TextStylePicker } from "../toolbar/text-style-picker";
import { ToolbarButton } from "../toolbar/toolbar-button";
import { ToolbarSeparator } from "../toolbar/toolbar-separator";

interface TextBubbleMenuProps {
  editor: Editor;
}

function shouldShowTextMenu({
  editor,
  state,
}: {
  editor: Editor;
  state: EditorState;
  from: number;
  to: number;
}): boolean {
  if (state.selection.empty) return false;
  if (!(state.selection instanceof TextSelection)) return false;
  if (editor.isActive("codeBlock")) return false;
  const { $from } = state.selection;
  const node = $from.node($from.depth);
  if (node?.type.name === "image") return false;
  return true;
}

// Mirror greyboard: pin the floating menu to the live DOM selection rect.
// Without this `BubbleMenu` falls back to the editor root's bounding box
// and the menu lands at the left edge instead of above the highlighted
// text. Returns null when there's no usable selection so Tiptap hides it.
function getTextSelectionVirtualElement(editor: Editor) {
  const selection = editor.view.dom.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const root =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentNode;
  if (!root || !editor.view.dom.contains(root)) return null;
  return {
    getBoundingClientRect: () => range.getBoundingClientRect(),
    getClientRects: () => Array.from(range.getClientRects()),
  };
}

export const TextBubbleMenu = memo(function TextBubbleMenu({
  editor,
}: TextBubbleMenuProps) {
  const [isEditingLink, setIsEditingLink] = useState(false);

  // Hide the link editor whenever the selection becomes invalid for the menu
  useEffect(() => {
    const onSelectionUpdate = () => {
      const { state } = editor;
      const visible = shouldShowTextMenu({
        editor,
        state,
        from: state.selection.from,
        to: state.selection.to,
      });
      if (!visible) setIsEditingLink(false);
    };
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="textBubbleMenu"
      updateDelay={150}
      // Portal to <body> — without this the menu inherits the workspace
      // panel's stacking + clipping context, so a centered (`placement:
      // "top"`) menu can render across the panel separator and visually
      // sit "behind" the divider.
      appendTo={() => editor.view.dom.ownerDocument.body}
      shouldShow={shouldShowTextMenu}
      getReferencedVirtualElement={() =>
        getTextSelectionVirtualElement(editor)
      }
      options={{
        // `top-start` anchors the menu's left edge to the selection's left
        // edge instead of centering it. Selections at the very left of the
        // editor (e.g. a single `/` after slash-menu dismissal) no longer
        // overflow into the adjacent panel.
        placement: "top-start",
        offset: { mainAxis: 8 },
        flip: true,
        shift: { padding: 8 },
        inline: true,
        strategy: "fixed",
      }}
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        className={cn("tiptap-bubble-menu")}
        data-testid="text-bubble-menu"
      >
        {isEditingLink ? (
          <BubbleLinkEditor
            editor={editor}
            onClose={() => setIsEditingLink(false)}
          />
        ) : (
          <>
            <TextStylePicker editor={editor} />
            <ToolbarSeparator />
            <FormatGroup editor={editor} />
            <ToolbarButton
              label="Link"
              onClick={() => setIsEditingLink(true)}
              isActive={editor.isActive("link")}
              tabIndex={-1}
            >
              <LinkIcon className="size-4" />
            </ToolbarButton>
          </>
        )}
      </div>
    </BubbleMenu>
  );
});

function BubbleLinkEditor({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(
    () => (editor.getAttributes("link").href as string) || "",
  );

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const apply = useCallback(() => {
    const trimmed = url.trim();
    if (trimmed) {
      try {
        const parsed = new URL(
          trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
        );
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return;
        }
        editor.chain().focus().setLink({ href: parsed.toString() }).run();
      } catch {
        return;
      }
    } else {
      editor.chain().focus().unsetLink().run();
    }
    onClose();
  }, [editor, onClose, url]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        apply();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [apply, onClose],
  );

  return (
    <Input
      ref={inputRef}
      type="url"
      value={url}
      onChange={(e) => setUrl(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={apply}
      placeholder="https://..."
      className="h-7 text-[13px] w-60"
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
