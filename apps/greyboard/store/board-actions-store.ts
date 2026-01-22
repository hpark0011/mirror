import { create } from "zustand";

type BoardActions = {
  importBoard: (content: string) => void;
  exportBoard: () => void;
  clearBoard: () => void;
};

interface BoardActionsStore extends BoardActions {
  _isRegistered: boolean;
  _registerActions: (actions: BoardActions) => void;
}

/**
 * Store for board imperative actions (import, export, clear).
 * Actions are registered by the Board component on mount.
 *
 * @example
 * // In Board component:
 * useBoardActionsStore.getState()._registerActions({ importBoard, exportBoard, clearBoard });
 *
 * // In TasksHeaderActions:
 * const { exportBoard, clearBoard } = useBoardActionsStore();
 */
export const useBoardActionsStore = create<BoardActionsStore>((set) => ({
  // Default no-op implementations (before Board mounts)
  importBoard: () => {},
  exportBoard: () => {},
  clearBoard: () => {},
  _isRegistered: false,

  _registerActions: (actions) =>
    set({
      importBoard: actions.importBoard,
      exportBoard: actions.exportBoard,
      clearBoard: actions.clearBoard,
      _isRegistered: true,
    }),
}));
