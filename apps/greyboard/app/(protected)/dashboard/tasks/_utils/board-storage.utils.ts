import { INITIAL_BOARD_STATE } from "@/config/board.config";
import type { BoardState } from "@/types/board.types";
import { getStorageKey } from "@/lib/storage-keys";
import {
  serializeBoardData,
  deserializeBoardData,
} from "./board-serialization.utils";

// ============================================================================
// Board Storage Constants
// ============================================================================

export const BOARD_STORAGE_KEY = getStorageKey("TASKS", "BOARD_STATE");

// ============================================================================
// Board Storage Helpers
// ============================================================================

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
