import type { BoardState, Column } from "../types/board.types";

export const COLUMNS: Column[] = [
  {
    id: "backlog",
    title: "Backlog",
    icon: "SquareStackFillIcon",
    iconColor: "text-icon-light",
    iconSize: "h-5 w-5",
  },
  {
    id: "to-do",
    title: "To Do",
    icon: "CircleDashedIcon",
    iconColor: "text-icon-light",
    iconSize: "h-[22px] w-[22px]",
  },
  {
    id: "in-progress",
    title: "In Progress",
    icon: "CircleLeftHalfFilledIcon",
    iconColor: "text-[var(--color-text-info)]",
    iconSize: "h-[22px] w-[22px]",
  },
  {
    id: "complete",
    title: "Complete",
    icon: "CheckedCircleFillIcon",
    iconColor: "text-[var(--color-text-success)]",
    iconSize: "h-[22px] w-[22px]",
  },
] as const;

export const INITIAL_BOARD_STATE: BoardState = {
  backlog: [],
  "to-do": [],
  "in-progress": [],
  complete: [],
};
