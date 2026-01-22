import type { Ticket, Project } from "@/types/board.types";

/**
 * Checks if two dates are on the same calendar day
 *
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @returns True if both dates are on the same day
 *
 * @example
 * isSameDay(new Date('2024-01-15 10:00'), new Date('2024-01-15 16:00')) // true
 * isSameDay(new Date('2024-01-15'), new Date('2024-01-16')) // false
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Filters tickets that were completed on a specific date
 *
 * @param tickets - Array of tickets to filter
 * @param date - Target date to filter by
 * @returns Array of tickets completed on the specified date
 *
 * @example
 * const todayTasks = getTasksCompletedOnDate(allTickets, new Date());
 */
export function getTasksCompletedOnDate(
  tickets: Ticket[],
  date: Date
): Ticket[] {
  return tickets.filter((ticket) => {
    if (!ticket.completedAt) return false;
    const completedDate = new Date(ticket.completedAt);
    return isSameDay(completedDate, date);
  });
}

/**
 * Gets time entries for a ticket that occurred on a specific date
 *
 * @param ticket - Ticket to get entries from
 * @param date - Target date to filter by
 * @returns Array of time entries that occurred on the specified date
 */
export function getTimeEntriesForDate(
  ticket: Ticket,
  date: Date
): import("@/types/board.types").TimeEntry[] {
  if (!ticket.timeEntries || ticket.timeEntries.length === 0) {
    return [];
  }

  return ticket.timeEntries.filter((entry) => {
    const entryDate = new Date(entry.end);
    return isSameDay(entryDate, date);
  });
}

/**
 * Calculates total duration for tickets on a specific date
 *
 * Only includes time from entries that occurred on the selected date,
 * not the lifetime total duration of the ticket.
 *
 * @param tickets - Array of tickets
 * @param date - Target date to calculate duration for
 * @returns Total duration in seconds for the specified date
 *
 * @example
 * const todaySeconds = calculateTotalDuration(allTickets, new Date());
 */
export function calculateTotalDuration(
  tickets: Ticket[],
  date: Date
): number {
  return tickets.reduce((sum, ticket) => {
    const entriesForDate = getTimeEntriesForDate(ticket, date);
    const dailyDuration = entriesForDate.reduce(
      (entrySum, entry) => entrySum + entry.duration,
      0
    );
    return sum + dailyDuration;
  }, 0);
}

/**
 * Calculates duration for a specific ticket on a specific date
 *
 * @param ticket - Ticket to calculate duration for
 * @param date - Target date
 * @returns Duration in seconds for the specified date
 */
export function getTicketDurationForDate(
  ticket: Ticket,
  date: Date
): number {
  const entries = getTimeEntriesForDate(ticket, date);
  return entries.reduce((sum, entry) => sum + entry.duration, 0);
}

/**
 * Groups completed tasks by project and calculates aggregate metrics for a specific date
 *
 * @param tickets - Array of tickets to group
 * @param projects - Array of available projects
 * @param date - Target date to calculate durations for
 * @returns Array of project summaries with task counts and durations
 *
 * @example
 * const projectStats = groupByProject(completedTasks, allProjects, new Date());
 */
export function groupByProject(
  tickets: Ticket[],
  projects: Project[],
  date: Date
): {
  projectId: string | null;
  projectName: string;
  projectColor: string;
  duration: number;
  taskCount: number;
}[] {
  const projectMap = new Map<string | null, {
    duration: number;
    taskCount: number;
  }>();

  // Initialize with null project for unassigned tasks
  projectMap.set(null, { duration: 0, taskCount: 0 });

  // Aggregate by project
  for (const ticket of tickets) {
    const projectId = ticket.projectId || null;
    const current = projectMap.get(projectId) || { duration: 0, taskCount: 0 };
    const dailyDuration = getTicketDurationForDate(ticket, date);

    // Only count tasks that have duration on this date
    if (dailyDuration > 0) {
      projectMap.set(projectId, {
        duration: current.duration + dailyDuration,
        taskCount: current.taskCount + 1,
      });
    }
  }

  // Convert to array with project details
  const result = [];

  for (const [projectId, stats] of projectMap.entries()) {
    if (stats.taskCount === 0) continue; // Skip projects with no tasks

    if (projectId === null) {
      result.push({
        projectId: null,
        projectName: "Unassigned",
        projectColor: "gray",
        duration: stats.duration,
        taskCount: stats.taskCount,
      });
    } else {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        result.push({
          projectId: project.id,
          projectName: project.name,
          projectColor: project.color,
          duration: stats.duration,
          taskCount: stats.taskCount,
        });
      }
    }
  }

  // Sort by duration (highest first)
  return result.sort((a, b) => b.duration - a.duration);
}

/**
 * Converts a timestamp to hours as a decimal (e.g., 9:30 AM = 9.5)
 *
 * @param date - Date to convert
 * @returns Hours as decimal value (0-24)
 *
 * @example
 * dateToHours(new Date('2024-01-15 09:30')) // 9.5
 * dateToHours(new Date('2024-01-15 14:45')) // 14.75
 */
export function dateToHours(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

/**
 * Gets an array of the last N days starting from a given date
 *
 * @param endDate - The most recent date (usually today)
 * @param days - Number of days to include
 * @returns Array of dates in descending order (most recent first)
 *
 * @example
 * getLastNDays(new Date(), 7) // [today, yesterday, ..., 6 days ago]
 */
export function getLastNDays(endDate: Date, days: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - i);
    date.setHours(0, 0, 0, 0);
    dates.push(date);
  }
  return dates;
}

/**
 * Formats a date for timeline display
 *
 * @param date - Date to format
 * @param referenceDate - Reference date (usually today) for relative labels
 * @returns Formatted string like "Today", "Yesterday", or "Mon, Dec 4"
 */
export function formatTimelineDate(date: Date, referenceDate: Date): string {
  if (isSameDay(date, referenceDate)) {
    return "Today";
  }

  const yesterday = new Date(referenceDate);
  yesterday.setDate(referenceDate.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Session data for timeline visualization
 */
export interface TimelineSession {
  startHour: number;
  endHour: number;
  duration: number;
  taskTitle: string;
  projectColor: string;
  taskId: string;
}

/**
 * Daily data for timeline visualization
 */
export interface TimelineDay {
  date: Date;
  dayLabel: string;
  sessions: TimelineSession[];
  totalDuration: number;
}

/**
 * Transforms tickets into timeline data for the last N days
 *
 * Creates a structure suitable for timeline/Gantt chart visualization,
 * showing work sessions across hours of the day for multiple days.
 *
 * Handles sessions that span midnight by splitting them into separate
 * entries for each day.
 *
 * @param tickets - All tickets (will be filtered for completed ones with time entries)
 * @param projects - Available projects for color mapping
 * @param endDate - Most recent date to include (usually today)
 * @param days - Number of days to include (default 7)
 * @returns Array of timeline data per day, sorted most recent first
 *
 * @example
 * const timelineData = getTimelineData(allTickets, allProjects, new Date(), 7);
 */
export function getTimelineData(
  tickets: Ticket[],
  projects: Project[],
  endDate: Date,
  days: number = 7
): TimelineDay[] {
  const dates = getLastNDays(endDate, days);

  // Create a map for efficient date lookups
  const dateMap = new Map<string, TimelineDay>();

  for (const date of dates) {
    const dateKey = date.toDateString();
    dateMap.set(dateKey, {
      date,
      dayLabel: formatTimelineDate(date, endDate),
      sessions: [],
      totalDuration: 0,
    });
  }

  // Process all tickets and their time entries
  for (const ticket of tickets) {
    if (!ticket.timeEntries || ticket.timeEntries.length === 0) continue;

    const project = ticket.projectId
      ? projects.find((p) => p.id === ticket.projectId)
      : null;

    for (const entry of ticket.timeEntries) {
      const startDate = new Date(entry.start);
      const endDate = new Date(entry.end);

      const startHour = dateToHours(startDate);
      const endHour = dateToHours(endDate);

      // Check if session spans midnight
      if (!isSameDay(startDate, endDate)) {
        // Split into two sessions

        // First session: from start to end of day (midnight)
        const firstDayKey = startDate.toDateString();
        const firstDayData = dateMap.get(firstDayKey);
        if (firstDayData) {
          const firstDayDuration =
            ((24 - startHour) / (24 - startHour + endHour)) * entry.duration;
          firstDayData.sessions.push({
            startHour,
            endHour: 24,
            duration: firstDayDuration,
            taskTitle: ticket.title,
            projectColor: project?.color || "gray",
            taskId: ticket.id,
          });
          firstDayData.totalDuration += firstDayDuration;
        }

        // Second session: from midnight to end
        const secondDayKey = endDate.toDateString();
        const secondDayData = dateMap.get(secondDayKey);
        if (secondDayData) {
          const secondDayDuration =
            (endHour / (24 - startHour + endHour)) * entry.duration;
          secondDayData.sessions.push({
            startHour: 0,
            endHour,
            duration: secondDayDuration,
            taskTitle: ticket.title,
            projectColor: project?.color || "gray",
            taskId: ticket.id,
          });
          secondDayData.totalDuration += secondDayDuration;
        }
      } else {
        // Normal case: session within same day
        const dayKey = startDate.toDateString();
        const dayData = dateMap.get(dayKey);
        if (dayData) {
          dayData.sessions.push({
            startHour,
            endHour,
            duration: entry.duration,
            taskTitle: ticket.title,
            projectColor: project?.color || "gray",
            taskId: ticket.id,
          });
          dayData.totalDuration += entry.duration;
        }
      }
    }
  }

  // Convert map back to array and sort sessions
  const result = Array.from(dateMap.values());
  for (const day of result) {
    day.sessions.sort((a, b) => a.startHour - b.startHour);
  }

  return result;
}
