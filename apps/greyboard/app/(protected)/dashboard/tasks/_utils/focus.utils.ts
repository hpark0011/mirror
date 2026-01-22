// ============================================================================
// Types
// ============================================================================

export type FocusData = {
  [date: string]: string; // "2025-08-29": "Complete the design system"
};

// ============================================================================
// Constants
// ============================================================================

export const MAX_DAYS_TO_KEEP = 7;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns today's date as a YYYY-MM-DD formatted string.
 *
 * @returns Date string in format "2025-01-14"
 *
 * @example
 * getTodayDateString() // "2025-01-14"
 */
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Removes focus entries older than MAX_DAYS_TO_KEEP days.
 *
 * @param data - FocusData object with date keys
 * @returns Cleaned FocusData with only recent entries
 *
 * @example
 * cleanupOldEntries({ "2025-01-01": "Old focus", "2025-01-14": "Today" })
 * // Returns only entries within the last 7 days
 */
export function cleanupOldEntries(data: FocusData): FocusData {
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
