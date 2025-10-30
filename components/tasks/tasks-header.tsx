"use client";

import Link from "next/link";
import type React from "react";
import { useRef, useState } from "react";
import {
  HeaderContainer,
  HeaderLogo,
  HeaderMenu,
} from "@/components/header/header-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigation } from "@/hooks/use-navigation";
import { useTodayFocus } from "@/hooks/use-today-focus";
import { cn } from "@/lib/utils";
import { FocusFormDialog } from "./focus-form-dialog";
import { ProjectFilter } from "./project-filter";

type HeaderProps = {
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onClear: () => void;
};

export function TasksHeader({ onImport, onClear }: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focusDialogOpen, setFocusDialogOpen] = useState(false);
  const [todayFocus, setTodayFocus] = useTodayFocus();
  const { getCurrentValue, handleNavigate, navItems } = useNavigation();

  return (
    <HeaderContainer className='justify-between'>
      <Breadcrumb>
        <BreadcrumbList className='items-center text-[14px] text-foreground sm:gap-0'>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href='/' aria-label='Go to home'>
                <HeaderLogo />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className='text-neutral-400/50 pt-0.5 dark:text-neutral-700 [&>svg]:!size-5 ml-1.5 '>
            <Icon
              name='LineDiagonalIcon'
              className=' text-neutral-400/50 dark:text-neutral-700'
            />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className='text-[14px]'>
              <Select value={getCurrentValue()} onValueChange={handleNavigate}>
                <SelectTrigger className='outline-none hover:bg-hover rounded-sm border-none data-[size=default]:h-6 data-[size=sm]:h-6 focus-visible:bg-extra-light focus-visible:ring-0'>
                  <div className='flex items-center gap-1.5 pr-0.5 py-0.5 rounded-sm leading-[1.0] '>
                    <SelectValue />
                    <Icon
                      name='TriangleFillDownIcon'
                      className='size-2 text-icon-extra-light'
                    />
                  </div>{" "}
                </SelectTrigger>
                <SelectContent
                  side='bottom'
                  align='start'
                  sideOffset={0}
                  className='rounded-[11px]'
                >
                  {navItems.map((item) => (
                    <SelectItem key={item.href} value={item.label}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <button
        type='button'
        onClick={() => setFocusDialogOpen(true)}
        className='bg-card shadow-xs border-border-highlight dark:border-white/2 border rounded-sm h-[24px] hover:bg-base  transition-all duration-200 ease-out cursor-pointer scale-100 absolute left-1/2 -translate-x-1/2 flex items-center translate-y-[0px] hover:translate-y-[-1px] hover:shadow-lg overflow-hidden text-[14px]'
      >
        <div className='text-text-muted font-medium px-2 h-full flex items-center'>
          {new Date().toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </div>
        <div className='w-px self-stretch mx-0 bg-border-light' />
        <span
          className={cn(
            "hover:bg-neutral-100 dark:hover:bg-neutral-700 px-2 h-full flex items-center dark:hover:text-white/70",
            todayFocus
              ? "text-text-primary font-medium"
              : "text-text-muted font-[480]"
          )}
        >
          {todayFocus || "Set today's focus"}
        </span>
      </button>
      <HeaderMenu>
        <ProjectFilter />

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant='icon'
                  className='h-6 w-6 cursor-pointer rounded-[6px]'
                >
                  <Icon
                    name='XmarkCircleFillIcon'
                    className='size-5.5 text-icon-light'
                  />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Clear All Board</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Board</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all tickets and reset the board to
                empty state. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onClear}>
                Clear Board
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </HeaderMenu>
      <input
        ref={fileInputRef}
        type='file'
        accept='.json'
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onImport(e);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        style={{ display: "none" }}
      />
      <FocusFormDialog
        open={focusDialogOpen}
        onOpenChange={setFocusDialogOpen}
        onSubmit={(data) => {
          setTodayFocus(data.focus);
          setFocusDialogOpen(false);
        }}
        defaultValue={todayFocus}
      />
    </HeaderContainer>
  );
}
