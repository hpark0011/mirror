// Components (Board-specific)
export { BoardView } from "./components/board-view";
export { BoardLayout } from "./components/board-layout";
export { BoardColumn } from "./components/board-column";
export { BoardColumnHeader } from "./components/board-column-header";

// Re-export everything from task-board-core for backward compatibility
export {
  // Context
  LayoutModeProvider,
  useLayoutMode,
  type LayoutPreference,
  // Hooks
  useBoardState,
  useBoardDnd,
  useBoardForm,
  type UseBoardStateReturn,
  type UseBoardDndOptions,
  type UseBoardDndReturn,
  type UseBoardFormOptions,
  type UseBoardFormReturn,
  type TicketFormValues,
  // Primitives
  ColumnTitle,
  AddTicketButton,
  DragOverlayWrapper,
  // Types
  type BoardState,
  type Ticket,
  type SubTask,
  type Column,
  type ColumnId,
  // Utils
  BOARD_STORAGE_KEY,
  serializeBoardData,
  deserializeBoardData,
  getInitialSerializedBoard,
  safelyDeserializeBoard,
  importBoardFromJson,
  downloadJsonFile,
  updateBoardWithTicket,
} from "@/features/task-board-core";

// Re-export timer utils from timer feature
export {
  formatDuration,
  handleTimerOnStatusChange,
  syncTimerOnTicketUpdate,
} from "@/features/timer";

// Alias for backward compatibility
export { DragOverlayWrapper as BoardDragOverlay } from "@/features/task-board-core";
