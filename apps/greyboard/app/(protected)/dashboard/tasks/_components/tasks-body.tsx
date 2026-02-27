"use client";

import { useCallback, useEffect, useRef } from "react";
import { closestCenter, DndContext } from "@dnd-kit/core";
import { COLUMNS } from "@feel-good/greyboard-core/config";
import {
  createTicketFromFormData,
  TicketFormDialog,
  updateTicketFromFormData,
} from "@/features/ticket-form";
import type { ColumnId } from "@feel-good/greyboard-core/types";
import { useBoardActionsStore } from "@/store/board-actions-store";
import {
  BoardDragOverlay,
  BoardView,
  type TicketFormValues,
  updateBoardWithTicket,
  useBoardDnd,
  useBoardForm,
  useBoardState,
  useLayoutMode,
} from "@/features/kanban-board";
import { ListView } from "@/features/task-list";
import { useStopWatchStore } from "@/features/timer";

export function TasksBody() {
  const { isListLayout } = useLayoutMode();
  const {
    board,
    filteredBoard,
    actions,
    findColumn,
    findTicket,
    lastSelectedProjectId,
    imperativeActions,
  } = useBoardState();

  const {
    isFormOpen,
    editingTicket,
    openCreate,
    openEdit,
    setIsFormOpen,
    defaultValues,
  } = useBoardForm({ lastSelectedProjectId });

  const { sensors, handlers, activeTicket } = useBoardDnd({
    board,
    findColumn,
    findTicket,
    onBoardUpdate: actions.setBoard,
    onStatusChange: actions.handleStatusChange,
  });

  // Register board actions to global store for header actions
  useEffect(() => {
    useBoardActionsStore.getState()._registerActions({
      importBoard: imperativeActions.importBoard,
      exportBoard: imperativeActions.exportBoard,
      clearBoard: imperativeActions.clearBoard,
    });
  }, [imperativeActions]);

  const isProcessingRef = useRef(false);

  const handleStartWork = useCallback(
    (ticketId: string) => {
      if (isProcessingRef.current) return;

      const ticket = findTicket(ticketId);
      if (!ticket || ticket.status !== "to-do") return;

      isProcessingRef.current = true;
      queueMicrotask(() => {
        isProcessingRef.current = false;
      });

      const updatedTicket = { ...ticket, status: "in-progress" as const };

      actions.setBoard((board) =>
        updateBoardWithTicket(board, updatedTicket, "to-do", "in-progress")
      );

      useStopWatchStore.getState().startTimer(ticketId);
    },
    [findTicket, actions],
  );

  const handleFormSubmit = useCallback(
    (data: TicketFormValues) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      queueMicrotask(() => {
        isProcessingRef.current = false;
      });

      // Save the selected project as the last selected
      actions.setLastSelectedProjectId(data.projectId);

      if (editingTicket) {
        const foundColumn = findColumn(editingTicket.id);
        if (!foundColumn) return;

        const oldColumn = foundColumn as ColumnId;
        const oldStatus = editingTicket.status;
        const newStatus = data.status;

        // Create updated ticket from form data
        const updatedTicket = updateTicketFromFormData(editingTicket, data);

        // Update board state (handles column movement)
        actions.setBoard((board) =>
          updateBoardWithTicket(board, updatedTicket, oldColumn, data.status)
        );

        // Handle timer logic if status changed
        if (oldStatus !== newStatus) {
          actions.handleStatusChange(editingTicket.id, oldStatus, newStatus);
        }
      } else {
        // Create new ticket from form data
        const newTicket = createTicketFromFormData(data);

        // Add to board
        actions.setBoard((board) =>
          updateBoardWithTicket(board, newTicket, null, data.status)
        );
      }

      setIsFormOpen(false);
    },
    [editingTicket, findColumn, actions, setIsFormOpen],
  );

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handlers.onDragStart}
        onDragOver={handlers.onDragOver}
        onDragEnd={handlers.onDragEnd}
      >
        {isListLayout
          ? (
            <ListView
              columns={COLUMNS}
              board={filteredBoard}
              onAddTicket={openCreate}
              onEditTicket={openEdit}
              onDeleteTicket={actions.deleteTicket}
              onClearColumn={actions.clearColumn}
              onUpdateSubTasks={actions.updateSubTasks}
              onStartWork={handleStartWork}
            />
          )
          : (
            <BoardView
              columns={COLUMNS}
              board={filteredBoard}
              onAddTicket={openCreate}
              onEditTicket={openEdit}
              onDeleteTicket={actions.deleteTicket}
              onClearColumn={actions.clearColumn}
              onUpdateSubTasks={actions.updateSubTasks}
              onStartWork={handleStartWork}
            />
          )}
        <BoardDragOverlay activeTicket={activeTicket} />
      </DndContext>

      <TicketFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={defaultValues}
        mode={editingTicket ? "edit" : "create"}
      />
    </>
  );
}
