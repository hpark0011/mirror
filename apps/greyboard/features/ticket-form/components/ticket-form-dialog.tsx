"use client";

import {
  type TicketFormInput,
  type TicketFormOutput,
  useTicketForm,
} from "@/app/(protected)/dashboard/tasks/_hooks";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { GradientFade } from "@/components/ui/gradient-fade";
import { Input } from "@feel-good/ui/primitives/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { ProjectSelect } from "@/features/project-select";
import { useDialogAutoSave } from "@/hooks/use-dialog-auto-save";
import { useFocusManagement } from "@/hooks/use-focus-management";
import { useKeyboardSubmit } from "@/hooks/use-keyboard-submit";
import { usePersistedSubTasks } from "@/hooks/use-persisted-sub-tasks";
import { cn } from "@/lib/utils";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@feel-good/ui/primitives/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusSelect } from "../../../app/(protected)/dashboard/tasks/_components/status-select";
import { AutoResizingTextarea } from "../../../components/ui/auto-resizing-textarea";
import { Icon } from "../../../components/ui/icon";
import { SubTasksListForm } from "../../sub-task-list/components/sub-tasks-list";

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

  // Persist sub-tasks draft to localStorage (create mode only, never auto-clears)
  const { clearSubTasks } = usePersistedSubTasks(form, open, mode);

  // Show sub-tasks section when there are sub-tasks (manual toggle still works)
  // CREATE mode: Always start collapsed
  // EDIT mode: Start expanded if ticket has sub-tasks
  const [showSubTasks, setShowSubTasks] = useState(
    mode === "edit" && (defaultValues?.subTasks?.length ?? 0) > 0,
  );

  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmitWithCleanup = useCallback(
    (data: TicketFormOutput) => {
      setIsExpanded(false);
      handleSubmit(data);
      if (mode === "create") {
        clearSubTasks();
      }
    },
    [handleSubmit, clearSubTasks, mode],
  );

  // Track previous count to distinguish between user toggle and user removing items
  const prevCountRef = useRef<number>(defaultValues?.subTasks?.length ?? 0);
  const showSubTasksRef = useRef<boolean>(showSubTasks);
  const isInitialMountRef = useRef<boolean>(true);

  // Keep ref in sync with state
  useEffect(() => {
    showSubTasksRef.current = showSubTasks;
  }, [showSubTasks]);

  // Mark initial mount as complete after first render
  useEffect(() => {
    isInitialMountRef.current = false;
  }, []);

  // Auto-show/hide sub-tasks section based on sub-tasks existence
  useEffect(() => {
    const subscription = form.watch((values) => {
      const subTasksCount = values?.subTasks?.length ?? 0;
      const prevCount = prevCountRef.current;
      const currentShowSubTasks = showSubTasksRef.current;

      // Show when sub-tasks added (but not on initial load for CREATE mode)
      // This prevents auto-showing when persisted sub-tasks are loaded
      const shouldAutoShow = subTasksCount > 0 && !currentShowSubTasks;
      const isInitialLoad = isInitialMountRef.current && mode === "create";

      if (shouldAutoShow && !isInitialLoad) {
        setShowSubTasks(true);
      } // Hide only when user REMOVED last sub-task (went from 1+ to 0)
      // Don't hide if count was already 0 (user just toggled manually)
      else if (subTasksCount === 0 && prevCount > 0 && currentShowSubTasks) {
        setShowSubTasks(false);
      }

      // Update ref for next comparison
      prevCountRef.current = subTasksCount;
    });
    return () => subscription.unsubscribe();
  }, [form, mode]);

  const { handleOpenChange: autoSaveOpenChange, handleCancel: autoSaveCancel } =
    useDialogAutoSave({
      form,
      onSubmit: handleSubmitWithCleanup,
      onOpenChange,
    });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      autoSaveOpenChange(nextOpen);
      if (!nextOpen) {
        setIsExpanded(false);
        if (mode === "create") {
          clearSubTasks();
        }
      }
    },
    [autoSaveOpenChange, clearSubTasks, mode],
  );

  const handleCancel = useCallback(() => {
    setIsExpanded(false);
    if (mode === "create") {
      clearSubTasks();
    }
    autoSaveCancel();
  }, [autoSaveCancel, clearSubTasks, mode]);

  const { handleAutoFocus, handleTitleKeyDown, setRefs, setDescriptionRef } =
    useFocusManagement();

  useKeyboardSubmit({
    enabled: open,
    onSubmit: () => form.handleSubmit(handleSubmitWithCleanup)(),
  });

  const toggleSubTasks = () => setShowSubTasks(!showSubTasks);
  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "transition-none",
          isExpanded
            ? "h-[calc(100vh-32px)] sm:max-w-2xl  translate-y-[-50%]"
            : "translate-y-[-53%] sm:max-w-lg",
        )}
        onOpenAutoFocus={handleAutoFocus}
      >
        <DialogHeader className="sr-only">
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
          <form
            onSubmit={form.handleSubmit(handleSubmitWithCleanup)}
            className={cn(
              isExpanded && "grid grid-rows-[1fr_auto] h-full",
            )}
          >
            <DialogBody
              className={cn(
                "gap-0",
                isExpanded && "min-h-0 flex flex-col",
              )}
            >
              <div className="flex items-center gap-1">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <Input
                          placeholder="Enter ticket title…"
                          {...field}
                          ref={(el) => setRefs(el, field.ref)}
                          onKeyDown={handleTitleKeyDown}
                          variant="underline"
                          className={cn(
                            "md:text-text-primary h-auto px-2 rounded-md hover:bg-gray-1 placeholder:text-text-muted transition-all md:text-[18px] border-none w-full leading-[1.4] focus-visible:bg-gray-1",
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Tooltip delayDuration={1000}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={toggleExpanded}
                      className="shrink-0 hover:bg-gray-1"
                    >
                      <Icon
                        name={isExpanded
                          ? "ArrowDownrightAndArrowUpLeftIcon"
                          : "ArrowLeftUpAndRightDownIcon"}
                        className="size-5 text-icon"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={-4}>
                    {isExpanded ? "Collapse" : "Expand"}
                  </TooltipContent>
                </Tooltip>
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className={cn(isExpanded && "min-h-0 flex-1")}>
                    <FormLabel className="sr-only">Description</FormLabel>
                    <FormControl>
                      <div
                        className={cn(
                          "relative",
                          isExpanded && "h-full",
                        )}
                      >
                        <AutoResizingTextarea
                          placeholder="Enter ticket description..."
                          maxHeight={400}
                          fillParent={isExpanded}
                          {...field}
                          ref={(el) =>
                            setDescriptionRef(el, field.ref)}
                          className={cn(
                            "resize-none h-full rounded-md min-h-[160px] flex-1 border-none px-2 pb-4",
                            isExpanded && "h-full overflow-y-auto",
                          )}
                        />
                        {!isExpanded && <GradientFade />}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showSubTasks && (
                <FormField
                  control={form.control}
                  name="subTasks"
                  render={() => (
                    <FormItem>
                      <FormLabel className="sr-only">Sub-tasks</FormLabel>
                      <FormControl>
                        <div className="relative z-1 w-[calc(100%+12px)] ml-[-6px] border border-border-medium rounded-lg overflow-hidden">
                          <SubTasksListForm
                            control={form.control}
                            name={"subTasks"}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </DialogBody>

            <DialogFooter>
              <div className="flex flex-1 items-center">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Status</FormLabel>
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
                  name="projectId"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel className="sr-only">Project</FormLabel>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={toggleSubTasks}
                      size="icon-sm"
                      className="hover:bg-gray-1"
                    >
                      <Icon
                        name="CheckListIcon"
                        className={cn(
                          "size-4.5",
                          showSubTasks ? "text-blue-500" : "text-icon-light",
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={-4}>Add sub-tasks</TooltipContent>
                </Tooltip>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                size="sm"
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                {mode === "create" ? "Create Ticket" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
