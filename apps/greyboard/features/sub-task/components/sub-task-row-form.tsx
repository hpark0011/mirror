"use client";

import { memo } from "react";
import {
  type Control,
  type FieldArrayPath,
  type FieldPath,
  useController,
  useWatch,
} from "react-hook-form";
import type { TicketFormInput } from "@/app/(protected)/dashboard/tasks/_hooks";
import { SubTaskRow } from "./sub-task-row";

interface SubTaskRowFormProps {
  control: Control<TicketFormInput>;
  name: FieldArrayPath<TicketFormInput>;
  index: number;
  remove: (index?: number | number[]) => void;
}

/**
 * React Hook Form adapter for SubTaskRow.
 * Bridges RHF's Controller API to SubTaskRow's unified props.
 */
export const SubTaskRowForm = memo(function SubTaskRowForm({
  control,
  name,
  index,
  remove,
}: SubTaskRowFormProps) {
  const textFieldName = `${name}.${index}.text` as FieldPath<TicketFormInput>;
  const completedFieldName =
    `${name}.${index}.completed` as FieldPath<TicketFormInput>;

  // Watch the completed field for styling
  const completed = useWatch<TicketFormInput>({
    control,
    name: completedFieldName,
  }) as boolean | undefined;

  // Watch the text field
  const text = useWatch<TicketFormInput>({
    control,
    name: textFieldName,
  }) as string | undefined;

  // Get field setters via Controller
  const { field: textField } = useController({
    control,
    name: textFieldName,
  });

  const { field: completedField } = useController({
    control,
    name: completedFieldName,
  });

  return (
    <SubTaskRow
      text={typeof text === "string" ? text : ""}
      completed={!!completed}
      onCompletedChange={(value) => completedField.onChange(value)}
      onTextChange={(value) => textField.onChange(value)}
      onDelete={() => remove(index)}
    />
  );
});

SubTaskRowForm.displayName = "SubTaskRowForm";
