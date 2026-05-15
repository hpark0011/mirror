export function monthYearToEpochMs(month: number, year: number): number {
  return Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
}

export function epochMsToMonthYear(epochMs: number): {
  month: number;
  year: number;
} {
  const date = new Date(epochMs);
  return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}
