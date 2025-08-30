"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
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

export function FocusForm({
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
      <DialogContent className='sm:max-w-md px-4'>
        <DialogHeader className='mb-6'>
          <DialogTitle className='text-lg font-medium leading-[1]'>
            Set Today&apos;s Focus
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Set your focus for today to stay productive.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-6'
          >
            <FormField
              control={form.control}
              name='focus'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='sr-only'>
                    What&apos;s your focus for today?
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Enter your focus...'
                      {...field}
                      className='h-9 border-[1px] px-2.5 rounded-md placeholder:text-muted-foreground w-[calc(100%+8px)] ml-[-4px]'
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className='gap-1'>
              <Button
                type='button'
                variant='ghost'
                onClick={() => handleOpenChange(false)}
                size='sm'
              >
                Cancel
              </Button>
              <Button type='submit' variant='primary' size='sm'>
                Set Focus
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
