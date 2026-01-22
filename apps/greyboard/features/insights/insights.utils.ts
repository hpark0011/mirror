/**
 * Maps project color names to actual hex color values.
 * Falls back to gray if color is not found.
 */
export function getProjectColor(color: string): string {
  const colorMap: Record<string, string> = {
    gray: "#6b7280",
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
    pink: "#ec4899",
  };

  return colorMap[color] || colorMap.gray;
}
