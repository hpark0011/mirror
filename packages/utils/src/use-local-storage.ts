"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Initialize state with initialValue (SSR-safe)
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Track pending writes from setValue to distinguish user actions from sync updates
  const pendingWriteRef = useRef<{ value: T } | null>(null);

  // Load value from localStorage on client side
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        try {
          const parsed = JSON.parse(item);
          setStoredValue(parsed);
        } catch (parseError) {
          // JSON.parse validation: if parsing fails, fall back to initialValue
          console.warn(`Error parsing localStorage key "${key}":`, parseError);
          setStoredValue(initialValue);
        }
      }
    } catch (error) {
      console.warn(`Error loading localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listen for storage events to sync across tabs
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        if (e.newValue === null) {
          setStoredValue(initialValue);
        } else {
          try {
            const newValue = JSON.parse(e.newValue);
            setStoredValue(newValue);
          } catch (error) {
            console.warn(`Error parsing storage event for key "${key}":`, error);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, initialValue]);

  // Listen for same-tab localStorage changes via custom event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLocalStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; newValue: T }>;
      if (customEvent.detail.key === key) {
        setStoredValue(customEvent.detail.newValue);
      }
    };

    window.addEventListener("local-storage-change", handleLocalStorageChange);
    return () => window.removeEventListener("local-storage-change", handleLocalStorageChange);
  }, [key]);

  // Set value function — updater is pure, side effects deferred to useEffect
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      if (typeof window === "undefined") return;

      setStoredValue((currentStoredValue) => {
        const valueToStore =
          value instanceof Function ? value(currentStoredValue) : value;
        pendingWriteRef.current = { value: valueToStore };
        return valueToStore;
      });
    },
    []
  );

  // Persist to localStorage and dispatch custom event for user-initiated changes only
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pendingWriteRef.current) return;

    const { value: valueToWrite } = pendingWriteRef.current;
    pendingWriteRef.current = null;

    try {
      if (valueToWrite === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(valueToWrite));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        console.error("LocalStorage quota exceeded. Consider clearing some data.");
      }
    }

    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent("local-storage-change", {
          detail: { key, newValue: valueToWrite },
        })
      );
    });
  }, [key, storedValue]);

  // Clear value function
  const clearValue = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);

      // Dispatch custom event for same-tab synchronization
      // Use queueMicrotask to defer event dispatch until after current render
      queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent('local-storage-change', {
            detail: { key, newValue: initialValue },
          })
        );
      });
    } catch (error) {
      console.warn(`Error clearing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, clearValue];
}
