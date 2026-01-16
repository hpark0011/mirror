"use client";

import { Board } from "@/features/kanban-board";
import { TasksHeader } from "../_components/tasks-header";

export function TasksView() {
  return (
    <>
      <TasksHeader />
      <Board />
    </>
  );
}
