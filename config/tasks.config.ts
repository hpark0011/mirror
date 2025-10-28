import { ProjectColor } from "@/types/board.types";

export const PROJECT_COLORS: {
  color: ProjectColor;
  bgClass: string;
}[] = [
  { color: "gray", bgClass: "bg-neutral-500" },
  { color: "red", bgClass: "bg-red-500" },
  { color: "orange", bgClass: "bg-orange-500" },
  { color: "yellow", bgClass: "bg-yellow-500" },
  { color: "green", bgClass: "bg-green-500" },
  { color: "blue", bgClass: "bg-blue-500" },
  { color: "purple", bgClass: "bg-purple-500" },
  { color: "pink", bgClass: "bg-pink-500" },
];

export function getProjectColorBgClass(color: ProjectColor): string {
  return (
    PROJECT_COLORS.find((c) => c.color === color)?.bgClass || "bg-neutral-500"
  );
}
