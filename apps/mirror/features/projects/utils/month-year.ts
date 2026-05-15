export function monthYearToEpochMs(month: number, year: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("month must be an integer between 1 and 12");
  }
  return Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
}

export function epochMsToMonthYear(epochMs: number): {
  month: number;
  year: number;
} {
  const date = new Date(epochMs);
  return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}
