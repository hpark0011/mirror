import { IconName } from "@/components/ui/icon";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: ColumnId;
  projectId?: string;
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
