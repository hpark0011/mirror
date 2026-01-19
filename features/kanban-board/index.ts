// Context
export {
  LayoutModeProvider,
  useLayoutMode,
  type LayoutPreference,
} from "./context";

// Components
export { BoardColumn } from "./components/board-column";
export { BoardLayoutContainer } from "./components/board-layout-container";
export { BoardDragOverlay } from "./components/board-drag-overlay";

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

// Types
export type { BoardState, Ticket, SubTask, Column, ColumnId } from "./types";

// Utils
export {
  BOARD_STORAGE_KEY,
  serializeBoardData,
  deserializeBoardData,
  getInitialSerializedBoard,
  safelyDeserializeBoard,
  importBoardFromJson,
  downloadJsonFile,
  formatDuration,
  handleTimerOnStatusChange,
  updateBoardWithTicket,
  syncTimerOnTicketUpdate,
} from "./utils";
