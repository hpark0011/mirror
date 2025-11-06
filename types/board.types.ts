import type { IconName } from "@/components/ui/icon";

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface TimeEntry {
  start: Date;
  end: Date;
  duration: number; // Seconds recorded for this session
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: ColumnId;
  projectId?: string;
  subTasks?: SubTask[];
  duration?: number; // Total accumulated time in seconds
  timeEntries?: TimeEntry[]; // Recorded focus sessions for this ticket
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  color: ProjectColor;
}

export type ProjectColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

export interface Column {
  id: ColumnId;
  title: string;
  icon: IconName;
  iconColor: string;
  iconSize: string;
}

export type BoardState = Record<string, Ticket[]>;

export type ColumnId = "backlog" | "to-do" | "in-progress" | "complete";
