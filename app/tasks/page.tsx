"use client";

import { useRef } from "react";
import { Board, type BoardHandle } from "@/components/tasks/board";
import { TasksHeader } from "@/components/tasks/tasks-header";

export default function TasksPage() {
  const boardRef = useRef<BoardHandle>(null);

  return (
    <>
      <TasksHeader
        onImport={(e) => boardRef.current?.importFromInput(e)}
        onExport={() => boardRef.current?.exportBoard()}
        onClear={() => boardRef.current?.clearBoard()}
      />
      <Board ref={boardRef} />
    </>
  );
}
