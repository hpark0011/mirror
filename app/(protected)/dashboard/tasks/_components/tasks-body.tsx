"use client";

import { Fragment, useCallback, useEffect } from "react";
import { closestCenter, DndContext } from "@dnd-kit/core";
import { COLUMNS } from "@/config/board.config";
import {
  TicketFormDialog,
  createTicketFromFormData,
  updateTicketFromFormData,
} from "@/features/ticket-form";
import type { ColumnId } from "@/types/board.types";
import { useBoardActionsStore } from "@/store/board-actions-store";
import {
  useLayoutMode,
  useBoardState,
  useBoardDnd,
  useBoardForm,
  type TicketFormValues,
  BoardColumn,
  BoardDragOverlay,
  BoardLayoutContainer,
  updateBoardWithTicket,
  syncTimerOnTicketUpdate,
} from "@/features/kanban-board";

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

  const handleFormSubmit = useCallback(
    (data: TicketFormValues) => {
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

        // Sync timer title if changed
        syncTimerOnTicketUpdate(
          editingTicket.id,
          editingTicket.title,
          data.title
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
    [editingTicket, findColumn, actions, setIsFormOpen]
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
        <BoardLayoutContainer>
          {COLUMNS.map((column) => (
            <Fragment key={column.id}>
              <BoardColumn
                column={column}
                tickets={filteredBoard[column.id] || []}
                onAddTicket={() => openCreate(column.id)}
                onEditTicket={openEdit}
                onDeleteTicket={actions.deleteTicket}
                onClearColumn={
                  column.id === "complete"
                    ? () => actions.clearColumn("complete")
                    : undefined
                }
                onUpdateSubTasks={actions.updateSubTasks}
              />
              {!isListLayout && (
                <div className='w-[1px] min-w-[1px] bg-neutral-200 dark:bg-neutral-900 last:hidden' />
              )}
            </Fragment>
          ))}
        </BoardLayoutContainer>
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
