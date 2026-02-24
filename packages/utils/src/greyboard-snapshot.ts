export type SnapshotSource = "web" | "desktop" | "unknown";

export type SnapshotBoardState = Record<string, unknown[]>;

export interface SnapshotTimerState {
  activeTicketId: string | null;
}

export interface SnapshotUIState {
  layoutPreference: "board" | "list";
  selectedProjectIds: string[];
  lastSelectedProjectId: string | null;
  theme: "light" | "dark" | null;
}

export interface SnapshotMetadata {
  exportedAt: string;
  source: SnapshotSource;
}

export interface GreyboardSnapshotV2 {
  version: 2;
  board: SnapshotBoardState;
  projects: unknown[];
  timer: SnapshotTimerState;
  ui: SnapshotUIState;
  metadata: SnapshotMetadata;
}

const SNAPSHOT_VERSION = 2 as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBoardState(value: unknown): SnapshotBoardState {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: SnapshotBoardState = {};
  for (const [columnId, tickets] of Object.entries(value)) {
    normalized[columnId] = Array.isArray(tickets) ? [...tickets] : [];
  }

  return normalized;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeLayoutPreference(value: unknown): "board" | "list" {
  return value === "list" ? "list" : "board";
}

function normalizeTheme(value: unknown): "light" | "dark" | null {
  if (value === "light" || value === "dark") {
    return value;
  }

  return null;
}

function normalizeMetadata(
  value: unknown,
  fallbackSource: SnapshotSource,
): SnapshotMetadata {
  const now = new Date().toISOString();

  if (!isRecord(value)) {
    return {
      exportedAt: now,
      source: fallbackSource,
    };
  }

  const exportedAt =
    typeof value.exportedAt === "string" && !Number.isNaN(Date.parse(value.exportedAt))
      ? value.exportedAt
      : now;

  const source: SnapshotSource =
    value.source === "web" || value.source === "desktop" || value.source === "unknown"
      ? value.source
      : fallbackSource;

  return {
    exportedAt,
    source,
  };
}

function normalizeSnapshotShape(
  snapshot: {
    board: unknown;
    projects?: unknown;
    timer?: unknown;
    ui?: unknown;
    metadata?: unknown;
  },
  fallbackSource: SnapshotSource,
): GreyboardSnapshotV2 {
  const timerRecord = isRecord(snapshot.timer) ? snapshot.timer : {};
  const uiRecord = isRecord(snapshot.ui) ? snapshot.ui : {};

  return {
    version: SNAPSHOT_VERSION,
    board: normalizeBoardState(snapshot.board),
    projects: Array.isArray(snapshot.projects) ? [...snapshot.projects] : [],
    timer: {
      activeTicketId:
        typeof timerRecord.activeTicketId === "string" ? timerRecord.activeTicketId : null,
    },
    ui: {
      layoutPreference: normalizeLayoutPreference(uiRecord.layoutPreference),
      selectedProjectIds: normalizeStringArray(uiRecord.selectedProjectIds),
      lastSelectedProjectId:
        typeof uiRecord.lastSelectedProjectId === "string"
          ? uiRecord.lastSelectedProjectId
          : null,
      theme: normalizeTheme(uiRecord.theme),
    },
    metadata: normalizeMetadata(snapshot.metadata, fallbackSource),
  };
}

export function createEmptySnapshot(source: SnapshotSource = "unknown"): GreyboardSnapshotV2 {
  return {
    version: SNAPSHOT_VERSION,
    board: {},
    projects: [],
    timer: {
      activeTicketId: null,
    },
    ui: {
      layoutPreference: "board",
      selectedProjectIds: [],
      lastSelectedProjectId: null,
      theme: null,
    },
    metadata: {
      exportedAt: new Date().toISOString(),
      source,
    },
  };
}

export function createSnapshotFromBoard(
  board: SnapshotBoardState,
  options?: {
    source?: SnapshotSource;
    exportedAt?: string;
  },
): GreyboardSnapshotV2 {
  const base = createEmptySnapshot(options?.source ?? "unknown");
  return {
    ...base,
    board: normalizeBoardState(board),
    metadata: {
      exportedAt: options?.exportedAt ?? base.metadata.exportedAt,
      source: options?.source ?? base.metadata.source,
    },
  };
}

function isSnapshotV2(value: unknown): value is GreyboardSnapshotV2 {
  if (!isRecord(value)) {
    return false;
  }

  return value.version === SNAPSHOT_VERSION && "board" in value;
}

export function migrateLegacyBoard(legacyInput: unknown): GreyboardSnapshotV2 {
  if (!isRecord(legacyInput)) {
    throw new Error("Snapshot payload must be an object");
  }

  if (!("data" in legacyInput)) {
    throw new Error("Unsupported snapshot payload");
  }

  const legacyData = legacyInput.data;
  const lastModified = legacyInput.lastModified;

  return normalizeSnapshotShape(
    {
      board: legacyData,
      metadata: {
        exportedAt:
          typeof lastModified === "string" && !Number.isNaN(Date.parse(lastModified))
            ? lastModified
            : new Date().toISOString(),
        source: "unknown",
      },
    },
    "unknown",
  );
}

export function deserializeSnapshot(input: string | unknown): GreyboardSnapshotV2 {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;

  if (isSnapshotV2(parsed)) {
    return normalizeSnapshotShape(parsed, parsed.metadata.source);
  }

  return migrateLegacyBoard(parsed);
}

export function serializeSnapshot(snapshot: GreyboardSnapshotV2): string {
  return JSON.stringify(normalizeSnapshotShape(snapshot, snapshot.metadata.source));
}
