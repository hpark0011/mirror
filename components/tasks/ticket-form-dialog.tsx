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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { COLUMNS } from "@/config/board-config";
import { useDialogAutoSave } from "@/hooks/use-dialog-auto-save";
import { useFocusManagement } from "@/hooks/use-focus-management";
import {
  type TicketFormInput,
  type TicketFormOutput,
  useTicketForm,
} from "@/hooks/use-ticket-form";
import { cn } from "@/lib/utils";
import { AutoResizingTextarea } from "../ui/auto-resizing-textarea";
import { Icon, IconName } from "../ui/icon";
import { ChevronDownIcon } from "lucide-react";
import { SelectIcon } from "@radix-ui/react-select";

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
  icon: column.icon as IconName,
  iconColor: column.iconColor,
  iconSize: column.iconSize,
}));

export function TicketFormDialog({
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
                        <SelectTrigger className='pl-1.5'>
                          <SelectValue placeholder='Select a status' />
                          <div className='absolute right-[26px] self-stretch h-full top-0 w-[1px] bg-light' />
                          <SelectIcon asChild>
                            <ChevronDownIcon className='size-4 opacity-50' />
                          </SelectIcon>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COLUMN_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className='pl-1.5'
                          >
                            <div className='flex items-center gap-1 px-1 pl-0'>
                              <Icon
                                name={option.icon}
                                className={cn(
                                  option.iconColor,
                                  "min-h-5 min-w-5"
                                )}
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
