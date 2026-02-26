"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@feel-good/ui/primitives/card";
import { Checkbox } from "@feel-good/ui/primitives/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@feel-good/ui/primitives/dialog";
import { Input } from "@feel-good/ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@feel-good/ui/primitives/select";
import { Textarea } from "@feel-good/ui/primitives/textarea";
import {
  createSnapshotFromBoard,
  type GreyboardSnapshotV2,
  type SnapshotBoardState,
  type SnapshotSource,
} from "@feel-good/utils/greyboard-snapshot";
import { COLUMNS, INITIAL_BOARD_STATE } from "../config/board.config";
import type { WorkspaceStorageAdapter } from "../persistence/storage-adapter";
import type { BoardState, ColumnId, SubTask, Ticket, TimeEntry } from "../types/board.types";

const COLUMN_ORDER: ColumnId[] = ["backlog", "to-do", "in-progress", "complete"];
const MAX_IMPORT_SNAPSHOT_BYTES = 5 * 1024 * 1024;

interface TaskWorkspaceProps {
  storage: WorkspaceStorageAdapter;
  source: SnapshotSource;
}

interface TicketDialogState {
  mode: "create" | "edit";
  ticketId: string | null;
  sourceColumn: ColumnId | null;
  title: string;
  description: string;
  status: ColumnId;
  subTasks: SubTask[];
}

function createDefaultDialogState(columnId: ColumnId = "backlog"): TicketDialogState {
  return {
    mode: "create",
    ticketId: null,
    sourceColumn: null,
    title: "",
    description: "",
    status: columnId,
    subTasks: [],
  };
}

function createEmptyBoard(): BoardState {
  return {
    ...INITIAL_BOARD_STATE,
  };
}

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

function asOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSubTasks(value: unknown): SubTask[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      if (
        typeof item.id !== "string" ||
        typeof item.text !== "string" ||
        typeof item.completed !== "boolean"
      ) {
        return null;
      }

      return {
        id: item.id,
        text: item.text,
        completed: item.completed,
      };
    })
    .filter((item): item is SubTask => item !== null);
}

function normalizeTimeEntries(value: unknown): TimeEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.duration !== "number") {
        return null;
      }

      const fallback = new Date();
      return {
        start: asDate(entry.start, fallback),
        end: asDate(entry.end, fallback),
        duration: entry.duration,
      };
    })
    .filter((entry): entry is TimeEntry => entry !== null);
}

function normalizeTicket(rawTicket: unknown, fallbackStatus: ColumnId): Ticket | null {
  if (!isRecord(rawTicket)) {
    return null;
  }

  const now = new Date();
  const title = typeof rawTicket.title === "string" ? rawTicket.title.trim() : "";

  if (title.length === 0) {
    return null;
  }

  const status =
    rawTicket.status === "backlog" ||
    rawTicket.status === "to-do" ||
    rawTicket.status === "in-progress" ||
    rawTicket.status === "complete"
      ? rawTicket.status
      : fallbackStatus;
  const completedAt = asOptionalDate(rawTicket.completedAt);

  return {
    id: typeof rawTicket.id === "string" ? rawTicket.id : generateId("ticket"),
    title,
    description: typeof rawTicket.description === "string" ? rawTicket.description : "",
    status,
    projectId: typeof rawTicket.projectId === "string" ? rawTicket.projectId : undefined,
    subTasks: normalizeSubTasks(rawTicket.subTasks),
    duration: typeof rawTicket.duration === "number" ? rawTicket.duration : 0,
    timeEntries: normalizeTimeEntries(rawTicket.timeEntries),
    createdAt: asDate(rawTicket.createdAt, now),
    updatedAt: asDate(rawTicket.updatedAt, now),
    completedAt: status === "complete" ? (completedAt ?? now) : completedAt,
  };
}

function normalizeBoard(snapshot: GreyboardSnapshotV2): BoardState {
  const nextBoard = createEmptyBoard();

  for (const columnId of COLUMN_ORDER) {
    const rawColumn = snapshot.board[columnId];
    if (!Array.isArray(rawColumn)) {
      nextBoard[columnId] = [];
      continue;
    }

    nextBoard[columnId] = rawColumn
      .map((task) => normalizeTicket(task, columnId))
      .filter((task): task is Ticket => task !== null);
  }

  return nextBoard;
}

function serializeBoard(board: BoardState): SnapshotBoardState {
  const serialized: SnapshotBoardState = {};

  for (const columnId of COLUMN_ORDER) {
    serialized[columnId] = (board[columnId] ?? []).map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      completedAt: ticket.completedAt ? ticket.completedAt.toISOString() : null,
      timeEntries: (ticket.timeEntries ?? []).map((entry) => ({
        ...entry,
        start: entry.start.toISOString(),
        end: entry.end.toISOString(),
      })),
    }));
  }

  return serialized;
}

function createSnapshotWithBoard(
  baseSnapshot: GreyboardSnapshotV2 | null,
  board: BoardState,
  source: SnapshotSource
): GreyboardSnapshotV2 {
  const nextBoard = serializeBoard(board);
  const now = new Date().toISOString();
  const fallbackSnapshot = createSnapshotFromBoard(nextBoard, {
    source,
    exportedAt: now,
  });

  if (!baseSnapshot) {
    return fallbackSnapshot;
  }

  return {
    ...baseSnapshot,
    board: nextBoard,
    metadata: {
      ...baseSnapshot.metadata,
      exportedAt: now,
      source,
    },
  };
}

function findColumn(ticketId: string, board: BoardState): ColumnId | null {
  for (const columnId of COLUMN_ORDER) {
    if ((board[columnId] ?? []).some((ticket) => ticket.id === ticketId)) {
      return columnId;
    }
  }
  return null;
}

function moveTicketToColumn(
  board: BoardState,
  ticketId: string,
  targetColumn: ColumnId,
  overTicketId?: string
): BoardState {
  const sourceColumn = findColumn(ticketId, board);
  if (!sourceColumn) {
    return board;
  }

  const sourceTickets = [...(board[sourceColumn] ?? [])];
  const targetTickets = sourceColumn === targetColumn
    ? sourceTickets
    : [...(board[targetColumn] ?? [])];

  const sourceIndex = sourceTickets.findIndex((ticket) => ticket.id === ticketId);
  if (sourceIndex < 0) {
    return board;
  }

  const sourceTicket = sourceTickets[sourceIndex];
  if (!sourceTicket) {
    return board;
  }

  const now = new Date();
  const movedTicket: Ticket = {
    ...sourceTicket,
    status: targetColumn,
    updatedAt: now,
    completedAt: targetColumn === "complete"
      ? (sourceTicket.completedAt ?? now)
      : null,
  };

  sourceTickets.splice(sourceIndex, 1);

  if (sourceColumn === targetColumn) {
    const overIndex = overTicketId
      ? sourceTickets.findIndex((ticket) => ticket.id === overTicketId)
      : sourceTickets.length;

    if (overIndex >= 0) {
      sourceTickets.splice(overIndex, 0, movedTicket);
    } else {
      sourceTickets.push(movedTicket);
    }

    return {
      ...board,
      [sourceColumn]: sourceTickets,
    };
  }

  const targetIndex = overTicketId
    ? targetTickets.findIndex((ticket) => ticket.id === overTicketId)
    : targetTickets.length;

  if (targetIndex >= 0) {
    targetTickets.splice(targetIndex, 0, movedTicket);
  } else {
    targetTickets.push(movedTicket);
  }

  return {
    ...board,
    [sourceColumn]: sourceTickets,
    [targetColumn]: targetTickets,
  };
}

function DownloadSnapshotButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      Export snapshot
    </Button>
  );
}

function triggerDownload(content: string, filename: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read snapshot file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Could not read snapshot file"));
    };

    reader.readAsText(file);
  });
}

function SortableTicketCard({
  ticket,
  onOpen,
  onDelete,
}: {
  ticket: Ticket;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completedCount = (ticket.subTasks ?? []).filter((subTask) => subTask.completed).length;
  const totalCount = (ticket.subTasks ?? []).length;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        "space-y-2 rounded-md border border-border bg-background p-3",
        isDragging ? "opacity-50" : "opacity-100",
      ].join(" ")}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={onOpen}
      >
        <p className="text-sm font-medium">{ticket.title}</p>
        {ticket.description ? (
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{ticket.description}</p>
        ) : null}
      </button>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {totalCount > 0 ? `${completedCount}/${totalCount} subtasks` : "No subtasks"}
        </span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </article>
  );
}

function ColumnBoard({
  columnId,
  title,
  tickets,
  onAdd,
  onOpen,
  onDelete,
}: {
  columnId: ColumnId;
  title: string;
  tickets: Ticket[];
  onAdd: () => void;
  onOpen: (ticket: Ticket) => void;
  onDelete: (ticketId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: columnId });

  return (
    <Card className="flex min-h-[240px] flex-col gap-0 rounded-lg border border-border bg-card py-0">
      <CardHeader className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {title} ({tickets.length})
          </CardTitle>
          {columnId !== "complete" ? (
            <Button size="xs" variant="ghost" onClick={onAdd}>
              Add
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent ref={setNodeRef} className="flex flex-1 flex-col gap-2 overflow-auto p-3">
        <SortableContext
          id={columnId}
          items={tickets.map((ticket) => ticket.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks</p>
          ) : (
            tickets.map((ticket) => (
              <SortableTicketCard
                key={ticket.id}
                ticket={ticket}
                onOpen={() => onOpen(ticket)}
                onDelete={() => onDelete(ticket.id)}
              />
            ))
          )}
        </SortableContext>
      </CardContent>
    </Card>
  );
}

export function TaskWorkspace({ storage, source }: TaskWorkspaceProps) {
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard());
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<TicketDialogState>(() => createDefaultDialogState());
  const [newSubTaskText, setNewSubTaskText] = useState("");
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef(board);
  const snapshotRef = useRef<GreyboardSnapshotV2 | null>(null);
  const dragSourceColumnRef = useRef<ColumnId | null>(null);
  const dragCrossedColumnsRef = useRef(false);
  const dragLastCrossOverIdRef = useRef<string | null>(null);
  boardRef.current = board;

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const totalTasks = useMemo(
    () => COLUMN_ORDER.reduce((count, columnId) => count + (board[columnId] ?? []).length, 0),
    [board]
  );

  const persistBoard = useCallback(async (nextBoard: BoardState) => {
    setIsSaving(true);
    try {
      let baseSnapshot = snapshotRef.current;
      try {
        const latestSnapshot = await storage.loadSnapshot();
        snapshotRef.current = latestSnapshot;
        baseSnapshot = latestSnapshot;
      } catch {
        // Best effort: keep in-memory snapshot if storage refresh fails.
      }

      const nextSnapshot = createSnapshotWithBoard(
        baseSnapshot,
        nextBoard,
        source
      );
      const persistedSnapshot = await storage.saveSnapshot(nextSnapshot);
      snapshotRef.current = persistedSnapshot;
      setError(null);
    } catch (persistError) {
      setError(
        persistError instanceof Error
          ? persistError.message
          : "Failed to persist task state"
      );
    } finally {
      setIsSaving(false);
    }
  }, [source, storage]);

  useEffect(() => {
    let isCancelled = false;

    const loadState = async () => {
      setIsLoading(true);
      try {
        const snapshot = await storage.loadSnapshot();
        if (!isCancelled) {
          snapshotRef.current = snapshot;
          setBoard(normalizeBoard(snapshot));
          setError(null);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load task state");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadState();

    return () => {
      isCancelled = true;
    };
  }, [storage]);

  const openCreateDialog = useCallback((columnId: ColumnId) => {
    setDialogState(createDefaultDialogState(columnId));
    setNewSubTaskText("");
    setIsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((ticket: Ticket) => {
    const sourceColumn = findColumn(ticket.id, boardRef.current);
    setDialogState({
      mode: "edit",
      ticketId: ticket.id,
      sourceColumn,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      subTasks: [...(ticket.subTasks ?? [])],
    });
    setNewSubTaskText("");
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback((open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setDialogState(createDefaultDialogState());
      setNewSubTaskText("");
    }
  }, []);

  const updateDialogSubTask = useCallback((subTaskId: string, updater: (subTask: SubTask) => SubTask) => {
    setDialogState((previous) => ({
      ...previous,
      subTasks: previous.subTasks.map((subTask) =>
        subTask.id === subTaskId ? updater(subTask) : subTask
      ),
    }));
  }, []);

  const removeDialogSubTask = useCallback((subTaskId: string) => {
    setDialogState((previous) => ({
      ...previous,
      subTasks: previous.subTasks.filter((subTask) => subTask.id !== subTaskId),
    }));
  }, []);

  const addDialogSubTask = useCallback(() => {
    const text = newSubTaskText.trim();
    if (!text) {
      return;
    }

    setDialogState((previous) => ({
      ...previous,
      subTasks: [
        ...previous.subTasks,
        {
          id: generateId("subtask"),
          text,
          completed: false,
        },
      ],
    }));
    setNewSubTaskText("");
  }, [newSubTaskText]);

  const addQuickTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title) {
      return;
    }

    const now = new Date();
    const newTicket: Ticket = {
      id: generateId("ticket"),
      title,
      description: "",
      status: "backlog",
      subTasks: [],
      duration: 0,
      timeEntries: [],
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const nextBoard: BoardState = {
      ...boardRef.current,
      backlog: [newTicket, ...(boardRef.current.backlog ?? [])],
    };

    setBoard(nextBoard);
    boardRef.current = nextBoard;
    setNewTaskTitle("");
    await persistBoard(nextBoard);
  }, [newTaskTitle, persistBoard]);

  const saveDialog = useCallback(async () => {
    const title = dialogState.title.trim();
    if (!title) {
      setError("Title is required");
      return;
    }

    const now = new Date();
    const currentBoard = boardRef.current;
    let nextBoard = currentBoard;

    if (dialogState.mode === "edit" && dialogState.ticketId) {
      const sourceColumn = dialogState.sourceColumn ?? findColumn(dialogState.ticketId, currentBoard);
      if (!sourceColumn) {
        setError("Ticket could not be found");
        return;
      }

      const sourceTickets = [...(currentBoard[sourceColumn] ?? [])];
      const index = sourceTickets.findIndex((ticket) => ticket.id === dialogState.ticketId);
      if (index < 0) {
        setError("Ticket could not be found");
        return;
      }

      const existingTicket = sourceTickets[index];
      if (!existingTicket) {
        setError("Ticket could not be found");
        return;
      }

      const updatedTicket: Ticket = {
        ...existingTicket,
        title,
        description: dialogState.description,
        status: dialogState.status,
        subTasks: dialogState.subTasks,
        updatedAt: now,
        completedAt: dialogState.status === "complete"
          ? (existingTicket.completedAt ?? now)
          : null,
      };

      if (sourceColumn === dialogState.status) {
        sourceTickets[index] = updatedTicket;
        nextBoard = {
          ...currentBoard,
          [sourceColumn]: sourceTickets,
        };
      } else {
        nextBoard = {
          ...currentBoard,
          [sourceColumn]: sourceTickets.filter((ticket) => ticket.id !== updatedTicket.id),
          [dialogState.status]: [updatedTicket, ...(currentBoard[dialogState.status] ?? [])],
        };
      }
    } else {
      const newTicket: Ticket = {
        id: generateId("ticket"),
        title,
        description: dialogState.description,
        status: dialogState.status,
        subTasks: dialogState.subTasks,
        duration: 0,
        timeEntries: [],
        completedAt: dialogState.status === "complete" ? now : null,
        createdAt: now,
        updatedAt: now,
      };

      nextBoard = {
        ...currentBoard,
        [dialogState.status]: [newTicket, ...(currentBoard[dialogState.status] ?? [])],
      };
    }

    setBoard(nextBoard);
    boardRef.current = nextBoard;
    closeDialog(false);
    await persistBoard(nextBoard);
  }, [closeDialog, dialogState, persistBoard]);

  const deleteTicket = useCallback(async (ticketId: string) => {
    const currentBoard = boardRef.current;
    const columnId = findColumn(ticketId, currentBoard);
    if (!columnId) {
      return;
    }

    const nextBoard: BoardState = {
      ...currentBoard,
      [columnId]: (currentBoard[columnId] ?? []).filter((ticket) => ticket.id !== ticketId),
    };

    setBoard(nextBoard);
    boardRef.current = nextBoard;
    await persistBoard(nextBoard);
  }, [persistBoard]);

  const clearBoard = useCallback(async () => {
    const nextBoard = createEmptyBoard();
    setBoard(nextBoard);
    boardRef.current = nextBoard;
    await persistBoard(nextBoard);
  }, [persistBoard]);

  const handleImportSnapshot = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_IMPORT_SNAPSHOT_BYTES) {
      setError("Snapshot file is too large. Maximum supported size is 5MB.");
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
      return;
    }

    try {
      const content = await readFileAsText(file);
      const imported = await storage.importSnapshot(content);
      snapshotRef.current = imported;
      const nextBoard = normalizeBoard(imported);
      setBoard(nextBoard);
      boardRef.current = nextBoard;
      setError(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to import snapshot");
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }, [storage]);

  const exportSnapshot = useCallback(async () => {
    try {
      const serializedSnapshot = await storage.exportSnapshot();
      const dateStamp = new Date().toISOString().slice(0, 10);
      triggerDownload(serializedSnapshot, `greyboard-snapshot-${dateStamp}.json`);
      setError(null);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export snapshot");
    }
  }, [storage]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setActiveTicketId(activeId);
    dragSourceColumnRef.current = findColumn(activeId, boardRef.current);
    dragCrossedColumnsRef.current = false;
    dragLastCrossOverIdRef.current = null;
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const currentBoard = boardRef.current;
    const activeColumn = findColumn(activeId, currentBoard);
    if (!activeColumn) {
      return;
    }

    const overColumn = COLUMN_ORDER.includes(overId as ColumnId)
      ? (overId as ColumnId)
      : findColumn(overId, currentBoard);

    if (!overColumn) {
      return;
    }

    if (activeColumn === overColumn) {
      return;
    }

    const nextBoard = moveTicketToColumn(
      currentBoard,
      activeId,
      overColumn,
      COLUMN_ORDER.includes(overId as ColumnId) ? undefined : overId
    );

    dragCrossedColumnsRef.current = true;
    dragLastCrossOverIdRef.current = overId;
    setBoard(nextBoard);
    boardRef.current = nextBoard;
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicketId(null);

    if (!over) {
      dragSourceColumnRef.current = null;
      dragCrossedColumnsRef.current = false;
      dragLastCrossOverIdRef.current = null;
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const currentBoard = boardRef.current;
    const activeColumn = findColumn(activeId, currentBoard);
    const overColumn = COLUMN_ORDER.includes(overId as ColumnId)
      ? (overId as ColumnId)
      : findColumn(overId, currentBoard);

    if (!activeColumn || !overColumn) {
      dragSourceColumnRef.current = null;
      dragCrossedColumnsRef.current = false;
      dragLastCrossOverIdRef.current = null;
      return;
    }

    const skipSameColumnReorder =
      dragCrossedColumnsRef.current &&
      dragLastCrossOverIdRef.current === overId;

    if (
      dragSourceColumnRef.current === overColumn &&
      activeColumn === overColumn &&
      !skipSameColumnReorder &&
      !COLUMN_ORDER.includes(overId as ColumnId)
    ) {
      const items = [...(currentBoard[activeColumn] ?? [])];
      const activeIndex = items.findIndex((ticket) => ticket.id === activeId);
      const overIndex = items.findIndex((ticket) => ticket.id === overId);
      if (activeIndex >= 0 && overIndex >= 0 && activeIndex !== overIndex) {
        const reordered = arrayMove(items, activeIndex, overIndex);
        const nextBoard = {
          ...currentBoard,
          [activeColumn]: reordered,
        };
        setBoard(nextBoard);
        boardRef.current = nextBoard;
      }
    }

    dragSourceColumnRef.current = null;
    dragCrossedColumnsRef.current = false;
    dragLastCrossOverIdRef.current = null;
    await persistBoard(boardRef.current);
  }, [persistBoard]);

  const activeTicket = activeTicketId
    ? COLUMN_ORDER.flatMap((columnId) => board[columnId] ?? []).find((ticket) => ticket.id === activeTicketId) ?? null
    : null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading task workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen flex-col gap-4 p-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">TaskWorkspace</h1>
            <p className="text-sm text-muted-foreground">
              Shared workspace powered by a cross-platform snapshot storage adapter.
            </p>
            <p className="text-xs text-muted-foreground">Total tasks: {totalTasks}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => importInputRef.current?.click()}>
              Import snapshot
            </Button>
            <DownloadSnapshotButton onClick={() => void exportSnapshot()} />
            <Button variant="outline" onClick={() => void clearBoard()}>
              Clear board
            </Button>
            <span className="text-xs text-muted-foreground">
              {isSaving ? "Saving..." : "Saved"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            placeholder="Add a task to backlog"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addQuickTask();
              }
            }}
          />
          <Button onClick={() => void addQuickTask()}>Add task</Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <section className="grid flex-1 gap-3 overflow-auto pb-2 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => (
            <ColumnBoard
              key={column.id}
              columnId={column.id}
              title={column.title}
              tickets={board[column.id] ?? []}
              onAdd={() => openCreateDialog(column.id)}
              onOpen={openEditDialog}
              onDelete={(ticketId) => void deleteTicket(ticketId)}
            />
          ))}
        </section>
        <DragOverlay>
          {activeTicket ? (
            <div className="w-64 rounded-md border border-border bg-background p-3 opacity-90">
              <p className="text-sm font-medium">{activeTicket.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent showCloseButton={false} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === "create" ? "Create task" : "Edit task"}
            </DialogTitle>
            <DialogDescription>
              Update ticket content, status, and sub-tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="task-title">
                Title
              </label>
              <Input
                id="task-title"
                value={dialogState.title}
                onChange={(event) => {
                  const value = event.target.value;
                  setDialogState((previous) => ({ ...previous, title: value }));
                }}
                placeholder="Task title"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="task-description">
                Description
              </label>
              <Textarea
                id="task-description"
                value={dialogState.description}
                onChange={(event) => {
                  const value = event.target.value;
                  setDialogState((previous) => ({ ...previous, description: value }));
                }}
                className="min-h-[120px]"
                placeholder="Task description"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={dialogState.status}
                onValueChange={(value) => {
                  setDialogState((previous) => ({ ...previous, status: value as ColumnId }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Sub-tasks</p>
                <span className="text-xs text-muted-foreground">
                  {dialogState.subTasks.filter((subTask) => subTask.completed).length}/{dialogState.subTasks.length}
                </span>
              </div>

              {dialogState.subTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sub-tasks</p>
              ) : (
                <div className="space-y-2">
                  {dialogState.subTasks.map((subTask) => (
                    <div key={subTask.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={subTask.completed}
                        onCheckedChange={(checked) => {
                          updateDialogSubTask(subTask.id, (previous) => ({
                            ...previous,
                            completed: Boolean(checked),
                          }));
                        }}
                      />
                      <Input
                        value={subTask.text}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateDialogSubTask(subTask.id, (previous) => ({
                            ...previous,
                            text: value,
                          }));
                        }}
                      />
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeDialogSubTask(subTask.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  value={newSubTaskText}
                  placeholder="Add sub-task"
                  onChange={(event) => setNewSubTaskText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addDialogSubTask();
                    }
                  }}
                />
                <Button type="button" size="sm" variant="outline" onClick={addDialogSubTask}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveDialog()}>
              {dialogState.mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        onChange={(event) => {
          void handleImportSnapshot(event);
        }}
        className="hidden"
      />
    </div>
  );
}
