import { INITIAL_BOARD_STATE } from "@/config/board.config";
import { BoardState } from "@/types/board.types";
import { deserializeBoardData, serializeBoardData } from "@/lib/storage";
import { getStorageKey } from "@/lib/storage-keys";

export const BOARD_STORAGE_KEY = getStorageKey("TASKS", "BOARD_STATE");

export function getInitialSerializedBoard(): string {
  return serializeBoardData(INITIAL_BOARD_STATE);
}

export function safelyDeserializeBoard(raw: string | null | undefined): BoardState {
  if (!raw) {
    return INITIAL_BOARD_STATE;
  }

  try {
    return deserializeBoardData(raw);
  } catch {
    return INITIAL_BOARD_STATE;
  }
}

