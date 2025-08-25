"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Ticket } from "../../types/board.types";
import { Icon } from "../ui/icon";
import { COLUMNS } from "@/config/board-config";
import { DescriptionList } from "./description-list";

interface TicketDetailDialogProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getColumnConfig = (status: string) => {
  return COLUMNS.find((col) => col.id === status);
};

export function TicketDetailDialog({
  ticket,
  open,
  onOpenChange,
}: TicketDetailDialogProps) {
  if (!ticket) return null;

  const columnConfig = getColumnConfig(ticket.status);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-xl px-4'>
        <DialogHeader>
          <div className='flex flex-col items-start justify-between'>
            <DialogTitle className='text-xl font-medium leading-[1] mb-4'>
              {ticket.title}
            </DialogTitle>
            <DescriptionList
              items={[
                {
                  label: "Status",
                  value: (
                    <div className='flex items-center gap-1'>
                      {columnConfig && (
                        <Icon
                          name={columnConfig.icon}
                          className={`${columnConfig.iconColor} ${columnConfig.iconSize}`}
                        />
                      )}
                      <span className='text-xs text-text-tertiary'>
                        {columnConfig?.title}
                      </span>
                    </div>
                  ),
                },
                {
                  label: "Created At",
                  value: (
                    <div className='flex items-center gap-1 text-xs text-text-tertiary'>
                      <Icon
                        name='CalendarFillIcon'
                        className='text-icon-light size-[22px]'
                      />
                      <span>{formatDate(ticket.createdAt)}</span>
                    </div>
                  ),
                },
                // {
                //   label: "Updated At",
                //   value: (
                //     <div className='flex items-center gap-1 text-xs text-text-tertiary'>
                //       <Icon
                //         name='CalendarFillIcon'
                //         className='text-icon-light size-[22px]'
                //       />
                //       <span>{formatDate(ticket.updatedAt)}</span>
                //     </div>
                //   ),
                // },
              ]}
            />
          </div>

          {ticket.description && (
            <>
              <div className='h-[1px] w-full bg-extra-light mt-2' />
              <DialogDescription className='mt-2 text-text-primary whitespace-pre-wrap text-md leading-[1.4]'>
                {ticket.description}
              </DialogDescription>
            </>
          )}
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
