const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function formatShortDate(date: string | number): string {
  return shortDateFormatter.format(new Date(date));
}

export function formatLongDate(date: string | number): string {
  return longDateFormatter.format(new Date(date));
}
