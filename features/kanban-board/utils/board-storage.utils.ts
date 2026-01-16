import type { BoardState, Ticket, TimeEntry } from "@/types/board.types";
import { INITIAL_BOARD_STATE } from "@/config/board.config";
import { getStorageKey } from "@/lib/storage-keys";

export const BOARD_STORAGE_KEY = getStorageKey("TASKS", "BOARD_STATE");

export interface SerializedBoardData {
  version: number;
  data: BoardState;
  lastModified: string;
}

const CURRENT_VERSION = 1;

/**
 * Serializes board state to a JSON string for export or storage.
 *
 * Converts all Date objects to ISO strings and wraps the data with versioning
 * information for future compatibility.
 *
 * @param boardState - The current board state to serialize
 * @returns JSON string representation of the board state
 * @throws Error if serialization fails
 */
export function serializeBoardData(boardState: BoardState): string {
  try {
    const serializedData: SerializedBoardData = {
      version: CURRENT_VERSION,
      data: serializeTickets(boardState),
      lastModified: new Date().toISOString(),
    };

    return JSON.stringify(serializedData);
  } catch (error) {
    console.error("Error serializing board data:", error);
    throw new Error("Failed to serialize board data");
  }
}

/**
 * Deserializes a JSON string back into board state.
 *
 * Converts ISO date strings back to Date objects and validates the data structure.
 *
 * @param data - JSON string containing serialized board data
 * @returns Deserialized board state
 * @throws Error if parsing or validation fails
 */
export function deserializeBoardData(data: string): BoardState {
  try {
    const parsed: SerializedBoardData = JSON.parse(data);

    return deserializeTickets(parsed.data);
  } catch (error) {
    console.error("Error deserializing board data:", error);
    throw new Error("Failed to deserialize board data");
  }
}

function serializeTickets(boardState: BoardState): BoardState {
  const serialized: BoardState = {};

  for (const [columnId, tickets] of Object.entries(boardState)) {
    serialized[columnId] = tickets.map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString() as unknown as Date,
      updatedAt: ticket.updatedAt.toISOString() as unknown as Date,
      completedAt: ticket.completedAt
        ? (ticket.completedAt.toISOString() as unknown as Date)
        : null,
      timeEntries: ticket.timeEntries?.map((entry) => ({
        ...entry,
        start: entry.start.toISOString() as unknown as Date,
        end: entry.end.toISOString() as unknown as Date,
      })),
    }));
  }

  return serialized;
}

function deserializeTickets(boardState: BoardState): BoardState {
  const deserialized: BoardState = {};

  for (const [columnId, tickets] of Object.entries(boardState)) {
    deserialized[columnId] = tickets.map((ticket) => ({
      ...ticket,
      createdAt: new Date(ticket.createdAt as unknown as string),
      updatedAt: new Date(ticket.updatedAt as unknown as string),
      completedAt: ticket.completedAt
        ? new Date(ticket.completedAt as unknown as string)
        : null,
      timeEntries: Array.isArray(ticket.timeEntries)
        ? (ticket.timeEntries as unknown as TimeEntry[]).map((entry) => ({
            ...entry,
            start: new Date(entry.start as unknown as string),
            end: new Date(entry.end as unknown as string),
          }))
        : [],
    }));
  }

  return deserialized;
}

export function validateBoardData(data: unknown): data is SerializedBoardData {
  if (!data || typeof data !== "object" || data === null) return false;

  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== "number") return false;
  if (!obj.data || typeof obj.data !== "object") return false;

  // Validate board structure
  for (const [, tickets] of Object.entries(
    obj.data as Record<string, unknown>
  )) {
    if (!Array.isArray(tickets)) return false;

    for (const ticket of tickets) {
      if (!isValidTicket(ticket)) return false;
    }
  }

  return true;
}

function isValidTicket(ticket: unknown): boolean {
  if (!ticket || typeof ticket !== "object" || ticket === null) return false;

  const t = ticket as Record<string, unknown>;

  // Validate subTasks if present
  const hasValidSubTasks =
    t.subTasks === undefined ||
    (Array.isArray(t.subTasks) &&
      t.subTasks.every((st: unknown) => {
        if (!st || typeof st !== "object") return false;
        const subTask = st as Record<string, unknown>;
        return (
          typeof subTask.id === "string" &&
          typeof subTask.text === "string" &&
          typeof subTask.completed === "boolean"
        );
      }));

  const hasValidTimeEntries =
    t.timeEntries === undefined ||
    (Array.isArray(t.timeEntries) &&
      t.timeEntries.every((entry: unknown) => {
        if (!entry || typeof entry !== "object") return false;
        const timeEntry = entry as Record<string, unknown>;
        return (
          typeof timeEntry.duration === "number" &&
          (timeEntry.start instanceof Date ||
            typeof timeEntry.start === "string") &&
          (timeEntry.end instanceof Date || typeof timeEntry.end === "string")
        );
      }));

  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.description === "string" &&
    typeof t.status === "string" &&
    (t.projectId === undefined || typeof t.projectId === "string") &&
    hasValidSubTasks &&
    (t.duration === undefined || typeof t.duration === "number") &&
    (t.completedAt === undefined ||
      t.completedAt === null ||
      t.completedAt instanceof Date ||
      typeof t.completedAt === "string") &&
    hasValidTimeEntries &&
    (t.createdAt instanceof Date || typeof t.createdAt === "string") &&
    (t.updatedAt instanceof Date || typeof t.updatedAt === "string")
  );
}

export function getInitialSerializedBoard(): string {
  return serializeBoardData(INITIAL_BOARD_STATE);
}

export function safelyDeserializeBoard(
  raw: string | null | undefined
): BoardState {
  if (!raw) {
    return INITIAL_BOARD_STATE;
  }

  try {
    return deserializeBoardData(raw);
  } catch {
    return INITIAL_BOARD_STATE;
  }
}
