"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnId, Ticket } from "@/types/board.types";
import type { TicketFormData } from "@/features/ticket-form";

/**
 * Re-export TicketFormData as TicketFormValues for backward compatibility.
 * The canonical type is TicketFormData in features/ticket-form.
 */
export type TicketFormValues = TicketFormData;

export interface UseBoardFormOptions {
  lastSelectedProjectId?: string;
}

export interface UseBoardFormReturn {
  isFormOpen: boolean;
  editingTicket: Ticket | null;
  openCreate: (columnId: ColumnId) => void;
  openEdit: (ticket: Ticket) => void;
  setIsFormOpen: (open: boolean) => void;
  defaultValues: TicketFormValues;
}

/**
 * Manages the ticket form dialog state including open/close,
 * create/edit modes, and default values.
 *
 * @example
 * const { isFormOpen, openCreate, openEdit, defaultValues } = useBoardForm({
 *   lastSelectedProjectId,
 * });
 */
export function useBoardForm({
  lastSelectedProjectId,
}: UseBoardFormOptions = {}): UseBoardFormReturn {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [formColumnId, setFormColumnId] = useState<ColumnId>("backlog");

  const openCreate = useCallback((columnId: ColumnId) => {
    setFormColumnId(columnId);
    setEditingTicket(null);
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback((ticket: Ticket) => {
    setEditingTicket(ticket);
    setFormColumnId(ticket.status);
    setIsFormOpen(true);
  }, []);

  const handleSetIsFormOpen = useCallback((open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingTicket(null);
    }
  }, []);

  const defaultValues = useMemo((): TicketFormValues => {
    if (editingTicket) {
      return {
        title: editingTicket.title,
        description: editingTicket.description,
        status: editingTicket.status,
        projectId: editingTicket.projectId,
        subTasks: editingTicket.subTasks || [],
      };
    }
    return {
      title: "",
      description: "",
      status: formColumnId,
      projectId: lastSelectedProjectId,
      subTasks: [],
    };
  }, [editingTicket, formColumnId, lastSelectedProjectId]);

  return {
    isFormOpen,
    editingTicket,
    openCreate,
    openEdit,
    setIsFormOpen: handleSetIsFormOpen,
    defaultValues,
  };
}
