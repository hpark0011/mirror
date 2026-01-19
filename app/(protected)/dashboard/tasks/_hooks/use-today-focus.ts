"use client";

import { useEffect, useRef } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";
import {
  type FocusData,
  getTodayDateString,
  cleanupOldEntries,
} from "../_utils";

// ============================================================================
// Constants
// ============================================================================

const TODAY_FOCUS_STORAGE_KEY = getStorageKey("UI", "TODAY_FOCUS");

// ============================================================================
// Today's Focus Hook
// ============================================================================

/**
 * Manages daily focus text with automatic cleanup of old entries.
 *
 * Stores focus text by date in localStorage (keeps last 7 days) and provides
 * methods to get/set today's focus.
 *
 * @returns Tuple containing today's focus text and a function to update it
 *
 * @example
 * const [todaysFocus, setTodaysFocus] = useTodayFocus();
 *
 * // Get today's focus
 * console.log(todaysFocus);
 *
 * // Set today's focus
 * setTodaysFocus("Complete the authentication module");
 */
export function useTodayFocus(): [string, (focus: string) => void] {
  const [focusData, setFocusData] = useLocalStorage<FocusData>(
    TODAY_FOCUS_STORAGE_KEY,
    {}
  );
  const hasCleanedRef = useRef(false);
  const todayKey = getTodayDateString();

  // Clean up old entries once on mount
  useEffect(() => {
    if (hasCleanedRef.current) return;
    hasCleanedRef.current = true;

    setFocusData((current) => {
      if (Object.keys(current).length === 0) return current;

      const cleaned = cleanupOldEntries(current);
      return Object.keys(cleaned).length !== Object.keys(current).length
        ? cleaned
        : current;
    });
  }, [setFocusData]);

  const todaysFocus = focusData[todayKey] || "";

  const setTodaysFocus = (focus: string) => {
    setFocusData((current) => ({
      ...current,
      [todayKey]: focus,
    }));
  };

  return [todaysFocus, setTodaysFocus];
}
