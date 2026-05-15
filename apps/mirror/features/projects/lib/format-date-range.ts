const MONTH_LABELS = [
  "01",
  "02",
  "03",
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
  const date = new Date(epochMs);
  return `${MONTH_LABELS[date.getUTCMonth()]}.${date.getUTCFullYear()}`;
}

function isSameMonthYear(a: number, b: number): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth()
  );
}

export function formatDateRange(start: number, end: number | null): string {
  const startLabel = formatMonthYear(start);
  if (end === null) return `${startLabel} ${EN_DASH} Present`;
  if (isSameMonthYear(start, end)) return startLabel;
  return `${startLabel} ${EN_DASH} ${formatMonthYear(end)}`;
}
