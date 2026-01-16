import { ProjectColor } from "@/types/board.types";

export const PROJECT_COLORS: {
  color: ProjectColor;
  bgClass: string;
}[] = [
  { color: "gray", bgClass: "bg-[var(--color-dq-gray-500)]" },
  { color: "red", bgClass: "bg-[var(--color-dq-red-500)]" },
  { color: "orange", bgClass: "bg-[var(--color-dq-yellow-600)]" },
  { color: "yellow", bgClass: "bg-[var(--color-dq-yellow-500)]" },
  { color: "green", bgClass: "bg-[var(--color-dq-green-500)]" },
  { color: "blue", bgClass: "bg-[var(--color-dq-blue-500)]" },
  { color: "purple", bgClass: "bg-[var(--color-dq-blue-600)]" },
  { color: "pink", bgClass: "bg-[var(--color-dq-red-400)]" },
];

export function getProjectColorBgClass(color: ProjectColor): string {
  return (
    PROJECT_COLORS.find((c) => c.color === color)?.bgClass ||
    "bg-[var(--color-dq-gray-500)]"
  );
}
