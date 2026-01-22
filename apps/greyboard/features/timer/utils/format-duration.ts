/**
 * Formats duration in seconds to a readable time string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "12:34" for 12 min 34 sec or "1:23:45" for 1 hour 23 min 45 sec)
 *
 * @example
 * formatDuration(0) // "0:00"
 * formatDuration(65) // "1:05"
 * formatDuration(3661) // "1:01:01"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
