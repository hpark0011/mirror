"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Initialize state with initialValue (SSR-safe)
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Load value from localStorage on client side
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        setStoredValue(parsed);
      }
    } catch (error) {
      console.warn(`Error loading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Listen for storage events to sync across tabs
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          setStoredValue(newValue);
        } catch (error) {
          console.warn(`Error parsing storage event for key "${key}":`, error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key]);

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

  // Set value function
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      if (typeof window === "undefined") return;

      setStoredValue((currentStoredValue) => {
        try {
          const valueToStore = value instanceof Function
            ? value(currentStoredValue)
            : value;

          // Handle undefined by removing the key instead of stringifying
          // JSON.stringify(undefined) produces "undefined" (invalid JSON)
          if (valueToStore === undefined) {
            window.localStorage.removeItem(key);

            // Dispatch custom event for same-tab synchronization
            queueMicrotask(() => {
              window.dispatchEvent(
                new CustomEvent('local-storage-change', {
                  detail: { key, newValue: undefined },
                })
              );
            });

            return valueToStore;
          }

          // Save to localStorage
          window.localStorage.setItem(key, JSON.stringify(valueToStore));

          // Dispatch custom event for same-tab synchronization
          // Use queueMicrotask to defer event dispatch until after current render
          // This prevents "Cannot update component during render" errors
          queueMicrotask(() => {
            window.dispatchEvent(
              new CustomEvent('local-storage-change', {
                detail: { key, newValue: valueToStore },
              })
            );
          });

          return valueToStore;
        } catch (error) {
          console.warn(`Error setting localStorage key "${key}":`, error);

          // Handle quota exceeded error
          if (error instanceof DOMException && error.name === "QuotaExceededError") {
            console.error("LocalStorage quota exceeded. Consider clearing some data.");
          }

          return currentStoredValue;
        }
      });
    },
    [key]
  );

  // Clear value function
  const clearValue = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error clearing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, clearValue];
}