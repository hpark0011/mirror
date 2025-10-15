import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
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
}

export function useTicketForm({
  defaultValues = {
    title: "",
    description: "",
    status: "backlog",
  },
  onSubmit,
}: UseTicketFormProps) {
  const form = useForm<TicketFormInput, unknown, TicketFormOutput>({
    resolver: zodResolver(ticketSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const handleSubmit = (data: TicketFormOutput) => {
    onSubmit(data);
    form.reset();
  };

  return {
    form,
    handleSubmit,
    ticketSchema,
  };
}

export type { TicketFormInput, TicketFormOutput };
