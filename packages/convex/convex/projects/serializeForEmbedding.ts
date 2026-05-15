const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function formatMonthYear(epochMs: number): string {
  const date = new Date(epochMs);
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${month} ${year}`;
}

export interface ProjectForSerialization {
  title: string;
  startDate: number;
  endDate: number | null;
  description?: string;
  link?: string;
}

export function serializeProjectForEmbedding(
  project: ProjectForSerialization,
): string {
  const start = formatMonthYear(project.startDate);
  const end =
    project.endDate === null ? "present" : formatMonthYear(project.endDate);
  const lead = `Project: ${project.title} from ${start} to ${end}.`;

  const tail: string[] = [];
  const description = project.description?.trim();
  if (description) {
    tail.push(/[.!?]$/.test(description) ? description : `${description}.`);
  }

  const link = project.link?.trim();
  if (link) {
    tail.push(`Project link: ${link}`);
  }

  return tail.length > 0 ? `${lead} ${tail.join(" ")}` : lead;
}
