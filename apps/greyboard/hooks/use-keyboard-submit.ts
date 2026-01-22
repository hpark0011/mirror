/**
 * Enables keyboard shortcut (Cmd/Ctrl+Enter) to submit forms.
 *
 * Useful for modal dialogs and forms where users expect quick submission.
 *
 * @param enabled - Whether the keyboard listener should be active
 * @param onSubmit - Callback to invoke when shortcut is pressed
 *
 * @example
 * useKeyboardSubmit({
 *   enabled: dialogOpen,
 *   onSubmit: () => form.handleSubmit(handleSubmit)(),
 * });
 */

import { useEffect, useRef } from "react";

interface UseKeyboardSubmitProps {
  enabled: boolean;
  onSubmit: () => void;
}

export function useKeyboardSubmit({
  enabled,
  onSubmit,
}: UseKeyboardSubmitProps) {
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        onSubmitRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);
}
