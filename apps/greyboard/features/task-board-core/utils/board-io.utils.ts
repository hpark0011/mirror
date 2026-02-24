/**
 * @fileoverview Board Import/Export Functions
 *
 * Utilities for importing board state from shared snapshots and exporting/downloading files.
 */

import {
  createSnapshotFromBoard,
  deserializeSnapshot,
  serializeSnapshot,
  type SnapshotBoardState,
} from "@feel-good/utils/greyboard-snapshot";
import type { BoardState } from "@/types/board.types";
import {
  deserializeBoardData,
  serializeBoardData,
  validateBoardData,
} from "./board-storage.utils";

interface LegacyBoardPayload {
  version: number;
  data: unknown;
  lastModified: string;
}

function createLegacyBoardPayload(
  data: unknown,
  lastModified: string
): LegacyBoardPayload {
  return {
    version: 1,
    data,
    lastModified,
  };
}

/**
 * Imports and validates board state from a snapshot JSON string.
 *
 * @param jsonData - Raw JSON string containing snapshot data
 * @returns Parsed and validated BoardState
 * @throws Error if JSON is invalid or board snapshot format is incorrect
 */
export function importBoardSnapshot(jsonData: string): BoardState {
  const snapshot = deserializeSnapshot(jsonData);
  const legacyPayload = createLegacyBoardPayload(
    snapshot.board,
    snapshot.metadata.exportedAt
  );

  if (!validateBoardData(legacyPayload)) {
    throw new Error("Invalid board snapshot format");
  }

  return deserializeBoardData(JSON.stringify(legacyPayload));
}

/**
 * Exports board state as a shared, versioned snapshot JSON string.
 *
 * @param boardState - Current board state
 * @returns Snapshot JSON payload
 */
export function exportBoardSnapshot(boardState: BoardState): string {
  const serializedBoard = JSON.parse(serializeBoardData(boardState)) as {
    data: SnapshotBoardState;
    lastModified: string;
  };
  const snapshot = createSnapshotFromBoard(serializedBoard.data, {
    source: "web",
    exportedAt: serializedBoard.lastModified,
  });

  return serializeSnapshot(snapshot);
}

/**
 * Downloads snapshot data as a JSON file in the browser.
 *
 * Creates a temporary blob URL and triggers a download. No-op in SSR context.
 *
 * @param data - String content to download as JSON
 * @param filename - Name for the downloaded file
 */
export function downloadSnapshotFile(data: string, filename: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
