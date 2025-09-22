"use client";

import { useRef } from "react";
import { Board, type BoardHandle } from "@/components/trello/board";
import { KanbanHeader } from "@/components/trello/kanban-header";

export default function TasksPage() {
  const boardRef = useRef<BoardHandle>(null);

  return (
    <>
      <KanbanHeader
        onImport={(e) => boardRef.current?.importFromInput(e)}
        onExport={() => boardRef.current?.exportBoard()}
        onClear={() => boardRef.current?.clearBoard()}
      />
      <Board ref={boardRef} />
    </>
  );
}
