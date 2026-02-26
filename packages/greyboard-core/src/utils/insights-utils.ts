import type { Project, Ticket, TimeEntry } from "../types/board.types";

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

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

export function getTimeEntriesForDate(
  ticket: Ticket,
  date: Date
): TimeEntry[] {
  if (!ticket.timeEntries || ticket.timeEntries.length === 0) {
    return [];
  }

  return ticket.timeEntries.filter((entry) => {
    const entryDate = new Date(entry.end);
    return isSameDay(entryDate, date);
  });
}

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

export function getTicketDurationForDate(
  ticket: Ticket,
  date: Date
): number {
  const entries = getTimeEntriesForDate(ticket, date);
  return entries.reduce((sum, entry) => sum + entry.duration, 0);
}

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

  projectMap.set(null, { duration: 0, taskCount: 0 });

  for (const ticket of tickets) {
    const projectId = ticket.projectId || null;
    const current = projectMap.get(projectId) || { duration: 0, taskCount: 0 };
    const dailyDuration = getTicketDurationForDate(ticket, date);

    if (dailyDuration > 0) {
      projectMap.set(projectId, {
        duration: current.duration + dailyDuration,
        taskCount: current.taskCount + 1,
      });
    }
  }

  const result = [];

  for (const [projectId, stats] of projectMap.entries()) {
    if (stats.taskCount === 0) continue;

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

  return result.sort((a, b) => b.duration - a.duration);
}

export function dateToHours(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

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

export interface TimelineSession {
  startHour: number;
  endHour: number;
  duration: number;
  taskTitle: string;
  projectColor: string;
  taskId: string;
}

export interface TimelineDay {
  date: Date;
  dayLabel: string;
  sessions: TimelineSession[];
  totalDuration: number;
}

export function getTimelineData(
  tickets: Ticket[],
  projects: Project[],
  endDate: Date,
  days: number = 7
): TimelineDay[] {
  const dates = getLastNDays(endDate, days);
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

  for (const ticket of tickets) {
    if (!ticket.timeEntries || ticket.timeEntries.length === 0) continue;

    const project = ticket.projectId
      ? projects.find((p) => p.id === ticket.projectId)
      : null;

    for (const entry of ticket.timeEntries) {
      const entryStartDate = new Date(entry.start);
      const entryEndDate = new Date(entry.end);

      const startHour = dateToHours(entryStartDate);
      const endHour = dateToHours(entryEndDate);

      if (!isSameDay(entryStartDate, entryEndDate)) {
        const firstDayKey = entryStartDate.toDateString();
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

        const secondDayKey = entryEndDate.toDateString();
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
        const dayKey = entryStartDate.toDateString();
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

  const result = Array.from(dateMap.values());
  for (const day of result) {
    day.sessions.sort((a, b) => a.startHour - b.startHour);
  }

  return result;
}
