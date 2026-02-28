import { useCallback, useRef } from "react";

export function useAutoResizeTextarea(maxHeight = 120) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [maxHeight]);

  const reset = useCallback(() => {
    if (ref.current) ref.current.style.height = "auto";
  }, []);

  return { ref, resize, reset };
}
