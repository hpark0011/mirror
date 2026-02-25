"use client";

import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@feel-good/ui/primitives/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const focusSchema = z.object({
  focus: z
    .string()
    .min(1, "Focus is required")
    .max(100, "Focus text is too long"),
});

type FocusFormInput = z.input<typeof focusSchema>;
type FocusFormOutput = z.output<typeof focusSchema>;

interface FocusFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FocusFormOutput) => void;
  defaultValue?: string;
}

export function FocusFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValue = "",
}: FocusFormProps) {
  const form = useForm<FocusFormInput, unknown, FocusFormOutput>({
    resolver: zodResolver(focusSchema),
    defaultValues: {
      focus: defaultValue,
    },
  });

  useEffect(() => {
    form.reset({ focus: defaultValue });
  }, [defaultValue, form]);

  const handleSubmit = (data: FocusFormOutput) => {
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
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="sr-only">Set Today&apos;s Focus</DialogTitle>
          <DialogDescription className="sr-only">
            Set your focus for today to stay productive.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="focus"
              render={({ field }) => (
                <FormItem className="gap-0">
                  <FormLabel className="sr-only">
                    What&apos;s your focus for today?
                  </FormLabel>
                  <FormControl>
                    <div className="flex items-center hover:bg-hover rounded-lg px-1 gap-0.5">
                      <Icon
                        name="TargetIcon"
                        className="size-6 text-icon-light"
                      />
                      <Input
                        placeholder="What's your focus for today?"
                        {...field}
                        className="h-9 border-none px-0 md:text-[16px]"
                        autoFocus
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="px-1 text-xs" />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                size="sm"
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Set Focus
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
