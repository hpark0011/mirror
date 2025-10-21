"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { formatFileSize, getFileCategory } from "@/lib/schema/file.schema";
import type { FileRow } from "@/types/file.types";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

const getFileIcon = (mimeType: string | null) => {
  if (!mimeType) return "DocTextLightIcon";

  const category = getFileCategory(mimeType);
  switch (category) {
    case "image":
      return "DocImageLightIcon";
    case "document":
      if (mimeType.includes("pdf")) return "DocPdfLightIcon";
      if (mimeType.includes("word")) return "DocTextLightIcon";
      return "DocTextLightIcon";
    default:
      return "DocTextLightIcon";
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatTokenCount = (count: number | null) => {
  if (count === null || count === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(count);
};

export const createColumns = (
  onDownload: (file: FileRow) => void,
  onDelete: (fileId: string) => void,
  downloadingFileId: string | null
): ColumnDef<FileRow>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className='px-2'
          size='sm'
        >
          Name
          <Icon name='ArrowUpAndDownIcon' className='ml-2 size-4' />
        </Button>
      );
    },
    cell: ({ row }) => {
      const file = row.original;
      return (
        <div className='flex items-center gap-1'>
          <Icon
            name={getFileIcon(file.mime_type)}
            className='w-8 h-8 text-muted-foreground flex-shrink-0'
          />
          <div className='flex flex-col min-w-0'>
            {/* <p className="font-medium text-sm truncate">{file.name}</p> */}
            <p className='truncate'>{file.original_name}</p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "size",
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className='h-8 px-2 -ml-2'
          size='sm'
        >
          Size
          <Icon name='ArrowUpAndDownIcon' className='ml-2 size-4' />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className='text-sm'>{formatFileSize(row.getValue("size"))}</div>
      );
    },
  },
  {
    accessorKey: "token_count",
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className='h-8 px-2 -ml-2'
          size='sm'
        >
          Token Count
          <Icon name='ArrowUpAndDownIcon' className='ml-2 size-4' />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className='text-sm'>
          {formatTokenCount(row.getValue("token_count"))}
        </div>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className='h-8 px-2 -ml-1.5'
          size='sm'
        >
          Created At
          <Icon name='ArrowUpAndDownIcon' className='ml-2 size-4' />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className='text-sm'>{formatDate(row.getValue("created_at"))}</div>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const file = row.original;
      const isDownloading = downloadingFileId === file.id;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-8 w-8 p-0'>
              <span className='sr-only'>Open menu</span>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onDownload(file)}
              disabled={isDownloading}
            >
              <Icon
                name='ArrowDownIcon'
                className={`mr-2 h-4 w-4 ${isDownloading ? "animate-pulse" : ""}`}
              />
              {isDownloading ? "Downloading..." : "Download"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(file.id)}
              className='text-destructive focus:text-destructive'
            >
              <Icon name='TrashIcon' className='mr-2 h-4 w-4' />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
