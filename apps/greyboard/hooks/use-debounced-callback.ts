"use client";

import { useEffect, useMemo, useRef } from "react";

export type DebouncedFunction<TArgs extends unknown[]> = ((
  ...args: TArgs
) => void) & { cancel: () => void };

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number
): DebouncedFunction<TArgs> {
  const callbackRef = useRef<(...args: TArgs) => void>(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debounced = useMemo(() => {
    const debouncedFn = ((...args: TArgs) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as DebouncedFunction<TArgs>;

    debouncedFn.cancel = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    return debouncedFn;
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debounced;
}
