"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useDialogAutoSave } from "@/hooks/use-dialog-auto-save";
import { useFocusManagement } from "@/hooks/use-focus-management";
import { useKeyboardSubmit } from "@/hooks/use-keyboard-submit";
import {
  type TicketFormInput,
  type TicketFormOutput,
  useTicketForm,
} from "@/hooks/use-ticket-form";
import { cn } from "@/lib/utils";
import { AutoResizingTextarea } from "../ui/auto-resizing-textarea";
import { ProjectSelect } from "./project-select/project-select";
import { StatusSelect } from "./status-select";

interface TicketFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TicketFormOutput) => void;
  defaultValues?: TicketFormInput;
  mode?: "create" | "edit";
}

export function TicketFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {
    title: "",
    description: "",
    status: "backlog",
    projectId: undefined,
  },
  mode = "create",
}: TicketFormProps) {
  const { form, handleSubmit } = useTicketForm({
    defaultValues,
    onSubmit,
    open,
  });

  const { handleOpenChange, handleCancel } = useDialogAutoSave({
    form,
    onSubmit: handleSubmit,
    onOpenChange,
  });

  const { handleAutoFocus, handleTitleKeyDown, setRefs, setDescriptionRef } =
    useFocusManagement();

  useKeyboardSubmit({
    enabled: open,
    onSubmit: () => form.handleSubmit(handleSubmit)(),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-xl' onOpenAutoFocus={handleAutoFocus}>
        <DialogHeader className='sr-only'>
          <VisuallyHidden asChild>
            <DialogTitle>
              {mode === "create" ? "Create New Ticket" : "Edit Ticket"}
            </DialogTitle>
          </VisuallyHidden>
          <VisuallyHidden asChild>
            <DialogDescription>
              {mode === "create"
                ? "Fill in the ticket details to create a new work item."
                : "Update the ticket fields and save your changes."}
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogBody className='mt-3 gap-0'>
              <div className='flex gap-0.5 items-center w-[calc(100%+12px)] ml-[-6px]'>
                <FormField
                  control={form.control}
                  name='title'
                  render={({ field }) => (
                    <FormItem className='w-full'>
                      <FormControl>
                        <Input
                          placeholder='Enter ticket title…'
                          {...field}
                          ref={(el) => setRefs(el, field.ref)}
                          onKeyDown={handleTitleKeyDown}
                          className={cn(
                            "md:text-text-primary h-auto py-0 px-2 rounded-[8px] placeholder:text-text-muted transition-all md:text-[18px] border-none w-full leading-[1.8]"
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                        ref={(el) => setDescriptionRef(el, field.ref)}
                        className={cn(
                          "resize-none h-full rounded-md min-h-[160px] flex-1 transition-all w-[calc(100%+12px)] ml-[-6px] border-transparent px-2"
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </DialogBody>

            <DialogFooter className='gap-1 w-full flex justify-between items-center p-3'>
              <div className='flex gap-1 flex-1'>
                <FormField
                  control={form.control}
                  name='status'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='sr-only'>Status</FormLabel>
                      <FormControl>
                        <StatusSelect
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='projectId'
                  render={({ field }) => {
                    console.log("[ticket-form-dialog] field:::", field);
                    return (
                      <FormItem>
                        <FormLabel className='sr-only'>Project</FormLabel>
                        <FormControl>
                          <ProjectSelect
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
              <Button
                type='button'
                variant='ghost'
                onClick={handleCancel}
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
