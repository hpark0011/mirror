"use client";

import type { Control, FieldArrayPath } from "react-hook-form";
import type { TicketFormInput } from "@/features/ticket-form";
import { SubTasksListControlled } from "./sub-tasks-list-controlled";
import { SubTasksListForm } from "./sub-tasks-list-form";
import type { SubTask } from "@feel-good/greyboard-core/types";

// Re-export types and components for backward compatibility
export type { SubTask } from "@feel-good/greyboard-core/types";
export { SubTasksListContainer } from "./sub-tasks-list-container";
export { SubTasksListHeader } from "./sub-tasks-list-header";
export { SubTasksListAddItem } from "./sub-tasks-list-add-item";
export { SubTasksListForm } from "./sub-tasks-list-form";
export { SubTasksListControlled } from "./sub-tasks-list-controlled";

interface SubTasksListFormProps {
  control: Control<TicketFormInput>;
  name?: FieldArrayPath<TicketFormInput>;
}

interface SubTasksListControlledProps {
  subTasks: SubTask[];
  onToggle: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  onAdd?: (text: string) => void;
  readOnly?: boolean;
}

type SubTasksListProps =
  | ({ variant?: "form" } & SubTasksListFormProps)
  | ({ variant?: "controlled" } & SubTasksListControlledProps);

/**
 * Unified subtasks list component with form and controlled variants.
 * Use variant="form" for React Hook Form integration.
 * Use variant="controlled" for external state management.
 */
export function SubTasksList(props: SubTasksListProps) {
  if ("control" in props) {
    return <SubTasksListForm control={props.control} name={props.name} />;
  }

  return (
    <SubTasksListControlled
      subTasks={props.subTasks}
      onToggle={props.onToggle}
      onTextChange={props.onTextChange}
      onDelete={props.onDelete}
      onAdd={props.onAdd}
      readOnly={props.readOnly}
    />
  );
}
