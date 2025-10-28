import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const ticketSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(1000, "Description is too long").default(""),
  status: z.enum(["backlog", "to-do", "in-progress", "complete"]),
  projectId: z.string().optional(),
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

  // Track previous open state to detect transitions
  const prevOpen = useRef(false);

  // Reset form only when dialog transitions from closed to open
  // Note: form.reset is stable, so we don't need form in the dependency array
  useEffect(() => {
    if (open && !prevOpen.current) {
      form.reset(defaultValues);
    }
    prevOpen.current = open ?? false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues]);

  const handleSubmit = (data: TicketFormOutput) => {
    onSubmit(data);
  };

  return {
    form,
    handleSubmit,
    ticketSchema,
  };
}

export type { TicketFormInput, TicketFormOutput };
