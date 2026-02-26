"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const ticketSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(10000, "Description is too long").default(""),
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

export function useTicketForm({
  defaultValues,
  onSubmit,
  open,
}: UseTicketFormProps) {
  const form = useForm<TicketFormInput, unknown, TicketFormOutput>({
    resolver: zodResolver(ticketSchema),
    defaultValues,
  });

  const prevOpen = useRef(false);

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
