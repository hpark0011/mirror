"use client";

import { useLocalStorage } from "./use-local-storage";
import { useEffect, useRef } from "react";

type FocusData = {
  [date: string]: string; // "2025-08-29": "Complete the design system"
};

const STORAGE_KEY = "today-focus";
const MAX_DAYS_TO_KEEP = 7;

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanupOldEntries(data: FocusData): FocusData {
  const today = new Date();
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - MAX_DAYS_TO_KEEP);

  const cleaned: FocusData = {};
  
  for (const [dateStr, focus] of Object.entries(data)) {
    const entryDate = new Date(dateStr);
    if (entryDate >= cutoffDate) {
      cleaned[dateStr] = focus;
    }
  }
  
  return cleaned;
}

export function useTodayFocus(): [string, (focus: string) => void] {
  const [focusData, setFocusData] = useLocalStorage<FocusData>(STORAGE_KEY, {});
  const hasCleanedRef = useRef(false);
  
  const todayKey = getTodayDateString();
  
  // Clean up old entries only once when component mounts
  useEffect(() => {
    // Only run cleanup once
    if (hasCleanedRef.current) {
      return;
    }
    
    // Mark as cleaned to prevent re-running
    hasCleanedRef.current = true;
    
    // Delay cleanup to ensure localStorage has loaded
    const timeoutId = setTimeout(() => {
      setFocusData((current) => {
        // Don't clean empty initial state
        if (Object.keys(current).length === 0) {
          return current;
        }
        
        const cleaned = cleanupOldEntries(current);
        // Only update if something was actually cleaned
        if (Object.keys(cleaned).length !== Object.keys(current).length) {
          return cleaned;
        }
        return current;
      });
    }, 100); // Small delay to ensure localStorage is loaded
    
    return () => clearTimeout(timeoutId);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const todaysFocus = focusData[todayKey] || "";
  
  const setTodaysFocus = (focus: string) => {
    setFocusData((current) => ({
      ...current,
      [todayKey]: focus,
    }));
  };
  
  return [todaysFocus, setTodaysFocus];
}