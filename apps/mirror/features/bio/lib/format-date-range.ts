/**
 * Pure helper that formats a bio entry's `[startDate, endDate]` pair for
 * display.
 *
 * Inputs are epoch ms anchored to the first-of-month UTC (per the storage
 * convention in `packages/convex/convex/bio/schema.ts`). Month derivation is
 * **UTC-anchored**, never the user's local timezone — otherwise an entry
 * stored as Jan 2022 UTC could render as Dec 2021 for a user east of UTC.
 *
 * Output cases:
 * - `endDate === null`            → `"Jan 2022 – Present"`
 * - `start month === end month`   → `"Jan 2024"`           (single-month range)
 * - both set, different months    → `"Jan 2022 – Mar 2024"`
 */
const MONTH_LABELS = [
  "01",
  "02",
  "03 ",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
] as const;

const EN_DASH = "–";

function formatMonthYear(epochMs: number): string {
  const d = new Date(epochMs);
  const monthIdx = d.getUTCMonth();
  const year = d.getUTCFullYear();
  return `${MONTH_LABELS[monthIdx]}.${year}`;
}

function isSameMonthYear(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth()
  );
}

export function formatDateRange(start: number, end: number | null): string {
  const startLabel = formatMonthYear(start);
  if (end === null) {
    return `${startLabel} ${EN_DASH} Present`;
  }
  if (isSameMonthYear(start, end)) {
    return startLabel;
  }
  return `${startLabel} ${EN_DASH} ${formatMonthYear(end)}`;
}
