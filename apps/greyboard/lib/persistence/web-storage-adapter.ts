"use client";

import {
  createSnapshotFromBoard,
  type GreyboardSnapshotV2,
  deserializeSnapshot,
  serializeSnapshot,
  type SnapshotBoardState,
} from "@feel-good/utils/greyboard-snapshot";
import type { WorkspaceStorageAdapter } from "@feel-good/greyboard-core/persistence";
import { getStorageKey } from "@/lib/storage-keys";
import {
  getInitialSerializedBoard,
  serializeBoardData,
  safelyDeserializeBoard,
} from "@/features/task-board-core/utils/board-storage.utils";
import { importBoardSnapshot } from "@/features/task-board-core/utils/board-io.utils";

interface TimerPayload {
  timers?: Record<string, unknown>;
}

function readRaw(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(key);
}

function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readBoardState(): SnapshotBoardState {
  const rawBoard = readRaw(getStorageKey("TASKS", "BOARD_STATE"));
  const board = safelyDeserializeBoard(rawBoard);
  const serialized = JSON.parse(serializeBoardData(board)) as {
    data: SnapshotBoardState;
  };

  return serialized.data;
}

function resolveActiveTicketId(): string | null {
  const timerPayload = readJson<TimerPayload>(getStorageKey("TASKS", "TIMER_STATE"), {});
  if (!timerPayload.timers || typeof timerPayload.timers !== "object") {
    return null;
  }

  const [firstTicketId] = Object.keys(timerPayload.timers);
  return firstTicketId ?? null;
}

function writeBoardState(snapshot: GreyboardSnapshotV2): void {
  const board = importBoardSnapshot(serializeSnapshot(snapshot));
  const serialized = serializeBoardData(board);
  window.localStorage.setItem(getStorageKey("TASKS", "BOARD_STATE"), serialized);
}

function writeUIState(snapshot: GreyboardSnapshotV2): void {
  window.localStorage.setItem(
    getStorageKey("UI", "LAYOUT_PREFERENCE"),
    JSON.stringify(snapshot.ui.layoutPreference)
  );

  window.localStorage.setItem(
    getStorageKey("TASKS", "PROJECT_FILTER"),
    JSON.stringify(snapshot.ui.selectedProjectIds)
  );

  if (snapshot.ui.lastSelectedProjectId) {
    window.localStorage.setItem(
      getStorageKey("TASKS", "LAST_SELECTED_PROJECT"),
      JSON.stringify(snapshot.ui.lastSelectedProjectId)
    );
  } else {
    window.localStorage.removeItem(getStorageKey("TASKS", "LAST_SELECTED_PROJECT"));
  }

  if (snapshot.ui.theme) {
    window.localStorage.setItem(getStorageKey("UI", "THEME"), snapshot.ui.theme);
  }
}

function writeProjects(snapshot: GreyboardSnapshotV2): void {
  window.localStorage.setItem(
    getStorageKey("TASKS", "PROJECTS"),
    JSON.stringify(snapshot.projects)
  );
}

function loadSnapshotFromLocalStorage(): GreyboardSnapshotV2 {
  const board = readBoardState();
  const layoutPreference = readJson<"board" | "list">(
    getStorageKey("UI", "LAYOUT_PREFERENCE"),
    "board"
  );
  const selectedProjectIds = readJson<string[]>(
    getStorageKey("TASKS", "PROJECT_FILTER"),
    []
  );
  const lastSelectedProjectId = readJson<string | null>(
    getStorageKey("TASKS", "LAST_SELECTED_PROJECT"),
    null
  );
  const projects = readJson<unknown[]>(getStorageKey("TASKS", "PROJECTS"), []);

  const themeRaw = readRaw(getStorageKey("UI", "THEME"));
  const theme = themeRaw === "light" || themeRaw === "dark" ? themeRaw : null;

  const snapshot = createSnapshotFromBoard(board, {
    source: "web",
  });

  return {
    ...snapshot,
    projects,
    timer: {
      activeTicketId: resolveActiveTicketId(),
    },
    ui: {
      layoutPreference,
      selectedProjectIds,
      lastSelectedProjectId,
      theme,
    },
  };
}

async function saveSnapshotToLocalStorage(snapshot: GreyboardSnapshotV2): Promise<GreyboardSnapshotV2> {
  if (typeof window === "undefined") {
    return snapshot;
  }

  writeBoardState(snapshot);
  writeUIState(snapshot);
  writeProjects(snapshot);

  return deserializeSnapshot(snapshot);
}

export const webStorageAdapter: WorkspaceStorageAdapter = {
  async loadSnapshot() {
    if (typeof window === "undefined") {
      return deserializeSnapshot(getInitialSerializedBoard());
    }

    return loadSnapshotFromLocalStorage();
  },

  async saveSnapshot(snapshot) {
    return saveSnapshotToLocalStorage(snapshot);
  },

  async importSnapshot(json) {
    const snapshot = deserializeSnapshot(json);
    return saveSnapshotToLocalStorage(snapshot);
  },

  async exportSnapshot() {
    const snapshot = loadSnapshotFromLocalStorage();
    return serializeSnapshot(snapshot);
  },
};

export default webStorageAdapter;
