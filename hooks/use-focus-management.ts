import { useRef, type KeyboardEvent } from "react";

export function useFocusManagement() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const handleAutoFocus = (event: Event) => {
    event.preventDefault();
    const input = inputRef.current;
    if (input) {
      input.focus({ preventScroll: true });
      try {
        const position = input.value?.length ?? 0;
        input.setSelectionRange(position, position);
      } catch {}
    }
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();
      const description = descriptionRef.current;
      if (description) {
        description.focus();
        // Move cursor to end of text
        try {
          const position = description.value?.length ?? 0;
          description.setSelectionRange(position, position);
        } catch {}
      }
    }
  };

  const setRefs = (
    el: HTMLInputElement | null,
    fieldRef: (el: HTMLInputElement | null) => void
  ) => {
    fieldRef(el);
    inputRef.current = el;
  };

  const setDescriptionRef = (
    el: HTMLTextAreaElement | null,
    fieldRef: (el: HTMLTextAreaElement | null) => void
  ) => {
    fieldRef(el);
    descriptionRef.current = el;
  };

  return {
    inputRef,
    descriptionRef,
    handleAutoFocus,
    handleTitleKeyDown,
    setRefs,
    setDescriptionRef,
  };
}
