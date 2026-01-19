"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

// ============================================================================
// Ticket Form Schema & Types
// ============================================================================

const ticketSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(1000, "Description is too long").default(""),
  status: z.enum(["backlog", "to-do", "in-progress", "complete"]),
  projectId: z.string().optional(),
  subTasks: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        completed: z.boolean(),
      })
    )
    .optional()
    .default([]),
});

type TicketFormInput = z.input<typeof ticketSchema>;
type TicketFormOutput = z.output<typeof ticketSchema>;

interface UseTicketFormProps {
  defaultValues?: TicketFormInput;
  onSubmit: (data: TicketFormOutput) => void;
  open?: boolean;
}

// ============================================================================
// Ticket Form Hook
// ============================================================================

/**
 * Manages ticket form state and validation.
 *
 * Handles form initialization, reset behavior on dialog open/close,
 * and submission with Zod validation.
 *
 * @param defaultValues - Initial form values
 * @param onSubmit - Callback when form is submitted with valid data
 * @param open - Dialog open state (triggers form reset on open transition)
 * @returns Object containing form instance, submit handler, and schema
 *
 * @example
 * const { form, handleSubmit } = useTicketForm({
 *   defaultValues: { title: "", status: "backlog" },
 *   onSubmit: (data) => createTicket(data),
 *   open: isDialogOpen
 * });
 */
export function useTicketForm({
  defaultValues,
  onSubmit,
  open,
}: UseTicketFormProps) {
  const form = useForm<TicketFormInput, unknown, TicketFormOutput>({
    resolver: zodResolver(ticketSchema),
    defaultValues,
  });

  // Track previous open state to detect transitions
  const prevOpen = useRef(false);

  // Reset form only when dialog transitions from closed to open
  useEffect(() => {
    if (open && !prevOpen.current) {
      form.reset(defaultValues);
    }
    prevOpen.current = open ?? false;
  }, [open, defaultValues, form]);

  return {
    form,
    handleSubmit: onSubmit,
    ticketSchema,
  };
}

export type { TicketFormInput, TicketFormOutput };
