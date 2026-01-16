import type { ColumnId, Ticket } from "@/types/board.types";

/**
 * Form data shape for ticket creation/editing.
 * Matches the output of the ticket form.
 */
export interface TicketFormData {
  title: string;
  description: string;
  status: ColumnId;
  projectId?: string;
  subTasks: Array<{ id: string; text: string; completed: boolean }>;
}

/**
 * Creates a new Ticket from form data.
 *
 * Generates a unique ID and sets initial timestamps. Sets completedAt
 * if the ticket is created in the "complete" status.
 *
 * @param data - Form values from the ticket form
 * @returns A new Ticket object ready to be added to the board
 *
 * @example
 * const ticket = createTicketFromFormData({
 *   title: "Fix bug",
 *   description: "Fix the login bug",
 *   status: "to-do",
 *   projectId: "proj-1",
 *   subTasks: []
 * });
 */
export function createTicketFromFormData(data: TicketFormData): Ticket {
  const now = new Date();
  return {
    id: `ticket-${Date.now()}`,
    title: data.title,
    description: data.description,
    status: data.status,
    projectId: data.projectId,
    subTasks: data.subTasks,
    duration: 0,
    timeEntries: [],
    completedAt: data.status === "complete" ? now : null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates an updated Ticket from an existing ticket and form data.
 *
 * Preserves ticket ID and timestamps, updating them appropriately.
 * Sets completedAt if moving to "complete" status, clears it otherwise.
 *
 * @param ticket - The existing ticket to update
 * @param data - Form values from the ticket form
 * @returns An updated Ticket object
 *
 * @example
 * const updated = updateTicketFromFormData(existingTicket, {
 *   title: "Updated title",
 *   description: "New description",
 *   status: "in-progress",
 *   projectId: "proj-2",
 *   subTasks: []
 * });
 */
export function updateTicketFromFormData(
  ticket: Ticket,
  data: TicketFormData
): Ticket {
  const now = new Date();
  return {
    ...ticket,
    title: data.title,
    description: data.description,
    status: data.status,
    projectId: data.projectId,
    subTasks: data.subTasks,
    updatedAt: now,
    completedAt:
      data.status === "complete" ? (ticket.completedAt ?? now) : null,
  };
}
