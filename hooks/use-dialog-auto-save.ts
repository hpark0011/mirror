import { useState } from "react";
import { FieldValues, UseFormReturn } from "react-hook-form";

interface UseDialogAutoSaveProps<TFieldValues extends FieldValues, TContext = any, TTransformedValues extends FieldValues = TFieldValues> {
  form: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
  onSubmit: (data: TTransformedValues) => void;
  onOpenChange: (open: boolean) => void;
}

export function useDialogAutoSave<
  TFieldValues extends FieldValues & { title?: string },
  TContext = any,
  TTransformedValues extends FieldValues & { title?: string } = TFieldValues
>({
  form,
  onSubmit,
  onOpenChange,
}: UseDialogAutoSaveProps<TFieldValues, TContext, TTransformedValues>) {
  const [isCancelAction, setIsCancelAction] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    // If dialog is opening, just pass through
    if (newOpen) {
      onOpenChange(newOpen);
      return;
    }

    // If cancel action, just close (form will reset on next open)
    if (isCancelAction) {
      setIsCancelAction(false);
      onOpenChange(newOpen);
      return;
    }

    // Try to save valid data on close
    const formValues = form.getValues();
    if (formValues.title && formValues.title.trim().length > 0) {
      // Type assertion through unknown for proper type conversion
      onSubmit(formValues as unknown as TTransformedValues);
      return;
    }

    // No valid data, just close (form will reset on next open)
    setIsCancelAction(false);
    onOpenChange(newOpen);
  };

  const handleCancel = () => {
    setIsCancelAction(true);
    handleOpenChange(false);
  };

  return {
    handleOpenChange,
    handleCancel,
    isCancelAction,
  };
}