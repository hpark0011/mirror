"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COLUMNS } from "@/config/board-config";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { AutoResizingTextarea } from "../ui/auto-resizing-textarea";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

const ticketSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").default(""),
  status: z.enum(["backlog", "not-started", "in-progress", "complete"]),
});

type TicketFormInput = z.input<typeof ticketSchema>;
type TicketFormOutput = z.output<typeof ticketSchema>;

interface TicketFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TicketFormOutput) => void;
  defaultValues?: TicketFormInput;
  mode?: "create" | "edit";
}

const COLUMN_OPTIONS = COLUMNS.map((column) => ({
  value: column.id,
  label: column.title,
  icon: column.icon,
  iconColor: column.iconColor,
  iconSize: column.iconSize,
}));

export function TicketForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {
    title: "",
    description: "",
    status: "backlog",
  },
  mode = "create",
}: TicketFormProps) {
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className='sm:max-w-xl px-4'
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const input = titleInputRef.current;
          if (input) {
            input.focus({ preventScroll: true });
            try {
              const position = input.value?.length ?? 0;
              input.setSelectionRange(position, position);
            } catch {}
          }
        }}
      >
        <DialogHeader>
          <VisuallyHidden asChild>
            <DialogTitle>
              {mode === "create" ? "Create New Ticket" : "Edit Ticket"}
            </DialogTitle>
          </VisuallyHidden>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-4'
          >
            <div>
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder='Enter ticket title…'
                        {...field}
                        ref={(el) => {
                          field.ref(el);
                          titleInputRef.current = el;
                        }}
                        className={cn(
                          "md:text-xl h-auto py-1 px-2 rounded-lg placeholder:text-text-muted transition-all w-[calc(100%+8px)] ml-[-4px] mt-[-4px]",
                          "border-transparent hover:border-light"
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='sr-only'>Description</FormLabel>
                    <FormControl>
                      <AutoResizingTextarea
                        placeholder='Enter ticket description...'
                        maxHeight={400}
                        {...field}
                        onFocus={() => setDescriptionFocused(true)}
                        onBlur={() => setDescriptionFocused(false)}
                        className={cn(
                          "resize-none h-full bg-transparent rounded-lg min-h-[160px] flex-1 transition-all w-[calc(100%+8px)] ml-[-4px] border-transparent hover:border-light px-2"
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className='gap-1 w-full flex justify-between items-center'>
              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem className='w-full'>
                    <FormLabel className='sr-only'>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className=''>
                          <SelectValue placeholder='Select a status' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COLUMN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className='flex items-center gap-1'>
                              <Icon
                                name={option.icon}
                                className={`${option.iconColor} ${option.iconSize}`}
                              />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type='button'
                variant='ghost'
                onClick={() => handleOpenChange(false)}
                size='sm'
              >
                Cancel
              </Button>
              <Button type='submit' variant='primary' size='sm'>
                {mode === "create" ? "Create Ticket" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
