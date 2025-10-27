"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, type Variants } from "framer-motion";
import { Ticket } from "../../types/board.types";
import { useProjects } from "@/hooks/use-projects";

const MotionWrapper = motion.div;

const PROJECT_COLOR_CLASSES: Record<string, string> = {
  gray: "bg-neutral-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

interface TicketCardProps {
  ticket: Ticket;
  isDragging?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  index?: number;
  isInitialLoad?: boolean;
}

const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.98,
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: index * 0.05,
      type: "spring" as const,
      damping: 20,
      stiffness: 300,
    },
  }),
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
};

export function TicketCard({
  ticket,
  isDragging = false,
  onEdit,
  onDelete,
  onClick,
  index = 0,
  isInitialLoad = false,
}: TicketCardProps) {
  const { getProjectById } = useProjects();
  const project = ticket.projectId
    ? getProjectById(ticket.projectId)
    : undefined;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSortableDragging ? transition : undefined,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const cardWrapperClassName = cn(
    "relative scale-100 hover:scale-[1.02] transition-all duration-200 ease-out",
    isDragging && "rotate-5 scale-105"
  );

  const statusStyles = {
    backlog: "",
    "to-do": "",
    "in-progress":
      "shadow-[0_8px_8px_-4px_rgba(255,255,255,0.9),_0_12px_12px_-6px_rgba(0,0,0,0.3)] hover:shadow-[0_24px_24px_-12px_rgba(255,255,255,0.9),_0_24px_24px_-12px_rgba(19, 10, 10, 0.3)] dark:shadow-[0_8px_12px_-4px_rgba(0,0,0,0.12),_0_12px_12px_-6px_rgba(0,0,0,0.9)] dark:hover:shadow-[0_24px_24px_-12px_rgba(255,255,255,0.15),_0_24px_24px_-12px_rgba(19, 10, 10, 0.3)] hover:bg-base",
    complete:
      "bg-white/80 dark:bg-card border-white/30 dark:border-white/2 row-span-full row-start-1 hidden border-x bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-black)]/5 md:col-start-3 md:block dark:[--pattern-fg:var(--color-white)]/5",
  };

  const cardClassName = cn(
    "bg-card border-card-border hover:bg-base dark:hover:bg-neutral-900 relative border transition-all duration-200 translate-y-0 hover:translate-y-[-1px] ease-out group cursor-grab active:cursor-grabbing p-0 gap-0 hover:border-opacity-100 inset-shadow-none shadow-xs hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.15),_0_14px_14px_-6px_rgba(0,0,0,0.9)] relative rounded-[12px]",
    statusStyles[ticket.status]
  );

  const handleClick = (e: React.MouseEvent) => {
    if (!isSortableDragging && onClick) {
      const target = e.target as HTMLElement;
      const isButton = target.closest("button");
      if (!isButton) {
        onClick();
      }
    }
  };

  const ProjectTag = () => {
    if (!project) return null;
    return (
      <div className='relative ml-[12px] w-fit'>
        <div className='flex items-center gap-[3px] bg-neutral-100 dark:bg-neutral-900 w-fit px-2 pl-2 py-[1px] rounded-t-md after:content-[""] after:absolute after:bottom-[-12px] after:left-0 after:w-full after:h-[12px] after:bg-neutral-100 dark:after:bg-neutral-900 relative border-card-border dark:border-neutral-900 border'>
          <div className='flex items-center justify-center'>
            <div
              className={cn(
                "size-[5px] mr-[1px] rounded-full",
                PROJECT_COLOR_CLASSES[project.color]
              )}
            />
          </div>
          <span className='text-xs text-text-tertiary'>{project.name}</span>
        </div>
        <div className='absolute bottom-[-3px] left-[-6px] bg-neutral-100 dark:bg-neutral-900'>
          <div
            className={cn(
              "w-[7px] h-[8px] bg-background rounded-br-full border-r border-b border-white dark:border-neutral-900",
              isDragging && "hidden"
            )}
          />
        </div>
        <div className='absolute bottom-[-1px] right-[-7px] bg-neutral-100 dark:bg-neutral-900'>
          <div
            className={cn(
              "w-[8px] h-[8px] bg-background rounded-bl-[6px] border-l border-b border-white dark:border-neutral-900",
              isDragging && "hidden"
            )}
          />
        </div>
      </div>
    );
  };

  const cardContent = (
    <>
      <CardHeader
        className={cn("p-3.5 py-2.5 flex", ticket.description && "pb-2 h-fit")}
      >
        <div className='flex items-center gap-1.5'>
          <div className='flex-1 min-w-0'>
            <CardTitle className='text-[15px] font-medium leading-[1.2]'>
              {ticket.title}
            </CardTitle>
          </div>
          {!isDragging && (
            <div className='absolute top-[6px] right-[6px] flex opacity-0 group-hover:opacity-100 flex-row items-center transition-opacity pointer-events-none group-hover:pointer-events-auto border rounded-md border-border-light bg-white dark:bg-neutral-800'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-6 w-7 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-none cursor-pointer hover:shadow-lg rounded-l-[7px] flex items-center justify-center has-[svg]:pl-0 has-[svg]:pr-0'
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.();
                    }}
                  >
                    <Icon
                      name='PencilIcon'
                      className='size-4.5 text-icon-dark'
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Ticket</TooltipContent>
              </Tooltip>
              <div className='self-stretch w-px bg-border-light' />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-6 w-7 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-none cursor-pointer hover:shadow-lg rounded-r-[7px] has-[svg]:pl-0 has-[svg]:pr-0'
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                  >
                    <Icon name='TrashIcon' className='size-4 text-icon-dark' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Ticket</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </CardHeader>

      {ticket.description && (
        <CardContent className='p-3.5 pt-0'>
          <p className='text-sm line-clamp-6 w-full leading-[120%] text-text-tertiary whitespace-pre-wrap'>
            {ticket.description}
          </p>
        </CardContent>
      )}
    </>
  );

  const commonWrapperProps = {
    ref: setNodeRef,
    style,
    className: cardWrapperClassName,
    onClick: handleClick,
    ...attributes,
    ...listeners,
  } as const;

  // Only use animated card for initial load
  if (isInitialLoad && !isSortableDragging) {
    return (
      <MotionWrapper
        variants={cardVariants}
        initial='hidden'
        animate='visible'
        custom={index}
        {...commonWrapperProps}
      >
        <ProjectTag />
        <Card className={cardClassName}>{cardContent}</Card>
      </MotionWrapper>
    );
  }

  // Regular non-animated card for all other cases
  return (
    <div {...commonWrapperProps}>
      <ProjectTag />
      <Card className={cardClassName}>{cardContent}</Card>
    </div>
  );
}
