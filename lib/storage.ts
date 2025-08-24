import { BoardState, Ticket } from "@/components/trello/types";

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
      createdAt: ticket.createdAt.toISOString() as any,
      updatedAt: ticket.updatedAt.toISOString() as any,
    }));
  }
  
  return serialized;
}

function deserializeTickets(boardState: BoardState): BoardState {
  const deserialized: BoardState = {};
  
  for (const [columnId, tickets] of Object.entries(boardState)) {
    deserialized[columnId] = tickets.map((ticket) => ({
      ...ticket,
      createdAt: new Date(ticket.createdAt as any),
      updatedAt: new Date(ticket.updatedAt as any),
    }));
  }
  
  return deserialized;
}

function migrateData(data: SerializedBoardData): SerializedBoardData {
  let migrated = { ...data };
  
  // Handle future migrations
  if (migrated.version < CURRENT_VERSION) {
    console.log(`Migrating board data from version ${migrated.version} to ${CURRENT_VERSION}`);
    
    // Add migration logic here for future schema changes
    // Example:
    // if (migrated.version < 2) {
    //   migrated = migrateToV2(migrated);
    // }
    
    migrated.version = CURRENT_VERSION;
  }
  
  return migrated;
}

export function validateBoardData(data: any): data is SerializedBoardData {
  if (!data || typeof data !== "object") return false;
  if (typeof data.version !== "number") return false;
  if (!data.data || typeof data.data !== "object") return false;
  
  // Validate board structure
  for (const [columnId, tickets] of Object.entries(data.data)) {
    if (!Array.isArray(tickets)) return false;
    
    for (const ticket of tickets) {
      if (!isValidTicket(ticket)) return false;
    }
  }
  
  return true;
}

function isValidTicket(ticket: any): ticket is Ticket {
  return (
    ticket &&
    typeof ticket === "object" &&
    typeof ticket.id === "string" &&
    typeof ticket.title === "string" &&
    typeof ticket.description === "string" &&
    typeof ticket.status === "string" &&
    (ticket.createdAt instanceof Date || typeof ticket.createdAt === "string") &&
    (ticket.updatedAt instanceof Date || typeof ticket.updatedAt === "string")
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