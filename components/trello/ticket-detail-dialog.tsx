"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Ticket } from "../../types/board.types";

interface TicketDetailDialogProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS = {
  backlog: "Backlog",
  "not-started": "Not Started",
  "in-progress": "In Progress",
  complete: "Complete",
} as const;

const STATUS_COLORS = {
  backlog: "bg-gray-100 text-gray-800",
  "not-started": "bg-blue-100 text-blue-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  complete: "bg-green-100 text-green-800",
} as const;

export function TicketDetailDialog({
  ticket,
  open,
  onOpenChange,
}: TicketDetailDialogProps) {
  if (!ticket) return null;

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="text-xl pr-4">{ticket.title}</DialogTitle>
            <Badge
              variant="secondary"
              className={`${STATUS_COLORS[ticket.status]} shrink-0`}
            >
              {STATUS_LABELS[ticket.status]}
            </Badge>
          </div>
          {ticket.description && (
            <DialogDescription className="mt-4 text-base text-text-secondary whitespace-pre-wrap">
              {ticket.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="mt-6 space-y-2 text-sm text-text-tertiary">
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{formatDate(ticket.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Last updated:</span>
            <span>{formatDate(ticket.updatedAt)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}