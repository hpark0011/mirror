import * as Icons from "@feel-good/icons";

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface TimeEntry {
  start: Date;
  end: Date;
  duration: number;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: ColumnId;
  projectId?: string;
  subTasks?: SubTask[];
  duration?: number;
  timeEntries?: TimeEntry[];
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
  icon: keyof typeof Icons;
  iconColor: string;
  iconSize: string;
}

export type ColumnId = "backlog" | "to-do" | "in-progress" | "complete";

export type BoardState = Record<string, Ticket[]>;
