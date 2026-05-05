// Generic React popup renderer for Tiptap @tiptap/suggestion plugins.
// Ported from greyboard/packages/features/editor/src/utils/suggestion-popup.ts.
// Owns positioning + Escape handling so each suggestion menu component only
// has to render its own list and forward keys to whatever picker (cmdk, etc.)
// it uses internally.
import type { Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";

export function updatePosition(
  popup: HTMLDivElement | null,
  clientRect: (() => DOMRect | null) | null | undefined,
) {
  if (!popup || !clientRect) return;
  const rect = clientRect();
  if (!rect) return;

  const popupRect = popup.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const fitsBelow = spaceBelow >= popupRect.height + 4;

  popup.style.left = `${rect.left}px`;
  popup.style.top = fitsBelow
    ? `${rect.bottom + 4}px`
    : `${rect.top - popupRect.height - 4}px`;
}

export function createSuggestionRenderer(
  // biome-ignore lint/suspicious/noExplicitAny: Tiptap suggestion components have varying prop types
  Component: React.ComponentType<any>,
) {
  return () => {
    let component: ReactRenderer<{
      onKeyDown?: (props: { event: KeyboardEvent }) => boolean;
    }> | null = null;
    let popup: HTMLDivElement | null = null;
    let escapeListener: ((e: KeyboardEvent) => void) | null = null;
    let editorRef: Editor | null = null;

    const removeEscapeListener = () => {
      if (escapeListener) {
        document.removeEventListener("keydown", escapeListener, true);
        escapeListener = null;
      }
    };

    const cleanup = () => {
      removeEscapeListener();
      popup?.remove();
      popup = null;
      component?.destroy();
      component = null;
    };

    return {
      // biome-ignore lint/suspicious/noExplicitAny: Tiptap Suggestion props are loosely typed
      onStart(props: any) {
        cleanup();
        editorRef = props.editor;

        component = new ReactRenderer(Component, {
          props,
          editor: props.editor,
        });

        popup = document.createElement("div");
        popup.style.position = "fixed";
        popup.style.zIndex = "50";
        document.body.appendChild(popup);

        popup.replaceChildren(component.element);
        requestAnimationFrame(() => updatePosition(popup, props.clientRect));

        escapeListener = (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            cleanup();
            editorRef?.commands.focus();
          }
        };
        document.addEventListener("keydown", escapeListener, true);
      },
      // biome-ignore lint/suspicious/noExplicitAny: Tiptap Suggestion props are loosely typed
      onUpdate(props: any) {
        component?.updateProps(props);
        updatePosition(popup, props.clientRect);
      },
      onKeyDown(props: { event: KeyboardEvent }) {
        return (
          (
            component?.ref as {
              onKeyDown?: (props: { event: KeyboardEvent }) => boolean;
            } | null
          )?.onKeyDown?.(props) ?? false
        );
      },
      onExit() {
        cleanup();
      },
    };
  };
}
