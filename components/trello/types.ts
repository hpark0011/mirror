export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: "not-started" | "in-progress" | "complete";
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: "not-started" | "in-progress" | "complete";
  title: string;
}

export type BoardState = Record<string, Ticket[]>;

export type ColumnId = "not-started" | "in-progress" | "complete";