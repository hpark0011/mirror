// Context
export {
  LayoutModeProvider,
  useLayoutMode,
  type LayoutPreference,
} from "./context";

// Hooks
export {
  useBoardState,
  useBoardDnd,
  useBoardForm,
  type UseBoardStateReturn,
  type UseBoardDndOptions,
  type UseBoardDndReturn,
  type UseBoardFormOptions,
  type UseBoardFormReturn,
  type TicketFormValues,
} from "./hooks";

// Primitives
export {
  ColumnTitle,
  AddTicketButton,
  DragOverlayWrapper,
} from "./primitives";

// Types
export type {
  BoardState,
  Ticket,
  SubTask,
  Column,
  ColumnId,
  TimeEntry,
  Project,
  ProjectColor,
} from "./types";

// Utils
export {
  BOARD_STORAGE_KEY,
  serializeBoardData,
  deserializeBoardData,
  getInitialSerializedBoard,
  safelyDeserializeBoard,
  importBoardSnapshot,
  exportBoardSnapshot,
  downloadSnapshotFile,
  updateBoardWithTicket,
} from "./utils";

// Re-export timer utils from timer feature
export {
  formatDuration,
  handleTimerOnStatusChange,
} from "@/features/timer";
