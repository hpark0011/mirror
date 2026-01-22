/**
 * @fileoverview Board Import/Export Functions
 *
 * Utilities for importing board state from JSON and exporting/downloading files.
 */

import type { BoardState } from "@/types/board.types";
import {
  validateBoardData,
  deserializeBoardData,
} from "./board-serialization.utils";

/**
 * Imports and validates board state from a JSON string.
 *
 * @param jsonData - Raw JSON string containing board data
 * @returns Parsed and validated BoardState
 * @throws Error if JSON is invalid or board data format is incorrect
 */
export function importBoardFromJson(jsonData: string): BoardState {
  const parsed = JSON.parse(jsonData);

  if (!validateBoardData(parsed)) {
    throw new Error("Invalid board data format");
  }

  return deserializeBoardData(jsonData);
}

/**
 * Downloads data as a JSON file in the browser.
 *
 * Creates a temporary blob URL and triggers a download. No-op in SSR context.
 *
 * @param data - String content to download as JSON
 * @param filename - Name for the downloaded file
 */
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
