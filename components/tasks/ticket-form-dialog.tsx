"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useDialogAutoSave } from "@/hooks/use-dialog-auto-save";
import { useFocusManagement } from "@/hooks/use-focus-management";
import {
  type TicketFormInput,
  type TicketFormOutput,
  useTicketForm,
} from "@/hooks/use-ticket-form";
import { cn } from "@/lib/utils";
import { AutoResizingTextarea } from "../ui/auto-resizing-textarea";
import { ProjectSelect } from "./project-select";
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
  });

  const { handleOpenChange, handleCancel } = useDialogAutoSave({
    form,
    onSubmit: handleSubmit,
    onOpenChange,
  });

  const { handleAutoFocus, setRefs } = useFocusManagement();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-xl' onOpenAutoFocus={handleAutoFocus}>
        <DialogHeader className='sr-only'>
          <VisuallyHidden asChild>
            <DialogTitle>
              {mode === "create" ? "Create New Ticket" : "Edit Ticket"}
            </DialogTitle>
          </VisuallyHidden>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogBody className='mt-4'>
              <div className='flex gap-2 items-baseline'>
                <FormField
                  control={form.control}
                  name='projectId'
                  render={({ field }) => (
                    <FormItem className=''>
                      <FormLabel className='sr-only'>Project</FormLabel>
                      <FormControl>
                        <ProjectSelect
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
                  name='title'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder='Enter ticket title…'
                          {...field}
                          ref={(el) => setRefs(el, field.ref)}
                          className={cn(
                            "md:text-lg h-auto py-1 px-2 rounded-lg placeholder:text-text-muted transition-all w-[calc(100%+8px)] ml-[-4px] mt-[-4px]",
                            "border-transparent hover:border-light"
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
                        className={cn(
                          "resize-none h-full bg-transparent rounded-lg min-h-[160px] flex-1 transition-all w-[calc(100%+8px)] ml-[-4px] border-transparent hover:border-light px-2"
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </DialogBody>

            <DialogFooter className='gap-1 w-full flex justify-between items-center '>
              <div className='flex gap-2 flex-1'>
                <FormField
                  control={form.control}
                  name='status'
                  render={({ field }) => (
                    <FormItem className='flex-1'>
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
