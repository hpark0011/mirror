import { BoardState, Column, ColumnId } from "@/types/board.types";
import { IconName } from "@/components/ui/icon";

export const COLUMNS: Column[] = [
  {
    id: "backlog",
    title: "Backlog",
    icon: "SquareStackFillIcon" as IconName,
    iconColor: "text-icon-light",
    iconSize: "h-5 w-5",
  },
  {
    id: "to-do",
    title: "To Do",
    icon: "CircleDashedIcon" as IconName,
    iconColor: "text-icon-light",
    iconSize: "h-[22px] w-[22px]",
  },
  {
    id: "in-progress",
    title: "In Progress",
    icon: "CircleLeftHalfFilledIcon" as IconName,
    iconColor: "text-blue-500",
    iconSize: "h-[22px] w-[22px]",
  },
  {
    id: "complete",
    title: "Complete",
    icon: "CheckedCircleFillIcon" as IconName,
    iconColor: "text-green-500",
    iconSize: "h-[22px] w-[22px]",
  },
] as const;

export const INITIAL_BOARD_STATE: BoardState = {
  backlog: [],
  "to-do": [],
  "in-progress": [],
  complete: [],
};
