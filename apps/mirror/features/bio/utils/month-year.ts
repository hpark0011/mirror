/**
 * Convert a `(month: 1-12, year)` pair into the epoch ms anchored to the
 * first of that month UTC — the storage convention used by the
 * `bioEntries` table.
 */
export function monthYearToEpochMs(month: number, year: number): number {
  return Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
}

/**
 * Inverse of `monthYearToEpochMs`. Returns `{ month: 1-12, year }`.
 */
export function epochMsToMonthYear(epochMs: number): {
  month: number;
  year: number;
} {
  const d = new Date(epochMs);
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}
