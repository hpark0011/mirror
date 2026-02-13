export type DatePreset = "today" | "this_week" | "this_month" | "this_year";

export function getDateRange(
  preset: DatePreset
): { start: Date; end: Date } {
  const now = new Date();

  switch (preset) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end: now };
    }

    case "this_week": {
      const dayOfWeek = now.getDay();
      // Convert Sunday (0) to 7, so Monday = 1, Sunday = 7
      const dayOfWeekNormalized = dayOfWeek === 0 ? 7 : dayOfWeek;
      // Days since Monday (Monday = 0)
      const daysSinceMonday = dayOfWeekNormalized - 1;
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysSinceMonday
      );
      return { start, end: now };
    }

    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }

    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: now };
    }

    default: {
      const _exhaustiveCheck: never = preset;
      return _exhaustiveCheck;
    }
  }
}
