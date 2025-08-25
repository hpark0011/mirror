import { BoardState, Ticket } from "@/types/board.types";

export interface SerializedBoardData {
  version: number;
  data: BoardState;
  lastModified: string;
}

const CURRENT_VERSION = 1;

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

export function deserializeBoardData(data: string): BoardState {
  try {
    const parsed: SerializedBoardData = JSON.parse(data);

    // Handle version migration if needed
    const migrated = migrateData(parsed);

    return deserializeTickets(migrated.data);
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
    }));
  }

  return deserialized;
}

function migrateData(data: SerializedBoardData): SerializedBoardData {
  const migrated = { ...data };

  // Handle future migrations
  if (migrated.version < CURRENT_VERSION) {
    console.log(
      `Migrating board data from version ${migrated.version} to ${CURRENT_VERSION}`
    );

    // Add migration logic here for future schema changes
    // Example:
    // if (migrated.version < 2) {
    //   migrated = migrateToV2(migrated);
    // }

    migrated.version = CURRENT_VERSION;
  }

  return migrated;
}

export function validateBoardData(data: unknown): data is SerializedBoardData {
  if (!data || typeof data !== "object" || data === null) return false;
  
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== "number") return false;
  if (!obj.data || typeof obj.data !== "object") return false;

  // Validate board structure
  for (const [, tickets] of Object.entries(obj.data as Record<string, unknown>)) {
    if (!Array.isArray(tickets)) return false;

    for (const ticket of tickets) {
      if (!isValidTicket(ticket)) return false;
    }
  }

  return true;
}

function isValidTicket(ticket: unknown): ticket is Ticket {
  if (!ticket || typeof ticket !== "object" || ticket === null) return false;
  
  const t = ticket as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.description === "string" &&
    typeof t.status === "string" &&
    (t.createdAt instanceof Date ||
      typeof t.createdAt === "string") &&
    (t.updatedAt instanceof Date || typeof t.updatedAt === "string")
  );
}

export function exportBoardAsJson(boardState: BoardState): string {
  return serializeBoardData(boardState);
}

export function importBoardFromJson(jsonData: string): BoardState {
  const parsed = JSON.parse(jsonData);

  if (!validateBoardData(parsed)) {
    throw new Error("Invalid board data format");
  }

  return deserializeBoardData(jsonData);
}

export function downloadJsonFile(data: string, filename: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
