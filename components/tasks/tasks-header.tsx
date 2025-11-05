"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { signOutAction } from "@/app/_actions/auth-actions";
import { customToast } from "@/components/custom-toast";
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
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PATHS } from "@/config/paths.config";
// import { useNavigation } from "@/hooks/use-navigation";
import { useTodayFocus } from "@/hooks/use-today-focus";
import { formatDuration } from "@/lib/timer-utils";
import { cn } from "@/lib/utils";
import { StopWatchState, useStopWatchStore } from "@/store/stop-watch-store";
import { FocusFormDialog } from "./focus-form-dialog";
import { ProjectFilter } from "./project-filter";

type HeaderProps = {
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onClear: () => void;
};

export function TasksHeader({ onImport, onClear }: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focusDialogOpen, setFocusDialogOpen] = useState(false);
  const [todayFocus, setTodayFocus] = useTodayFocus();
  // const { getCurrentValue, handleNavigate, navItems } = useNavigation();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [isSigningOut, startSignOutTransition] = useTransition();
  const activeTicketId = useStopWatchStore((state) => state.activeTicketId);
  const activeTicketTitle = useStopWatchStore(
    (state) => state.activeTicketTitle
  );
  const timerState = useStopWatchStore((state) => state.state);
  const activeElapsedSeconds = useStopWatchStore((state) => {
    if (!state.activeTicketId) {
      return 0;
    }
    return state.getElapsedTime(state.activeTicketId);
  });
  const hydrate = useStopWatchStore((state) => state._hydrate);

  // Hydrate timer state from localStorage after mount (prevents hydration errors)
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      const result = await signOutAction(undefined);

      if (result.success) {
        customToast({
          type: "success",
          title: "Signed out",
          description: "You have been signed out.",
        });
        router.push(PATHS.auth.signIn);
      } else {
        customToast({
          type: "error",
          title: "Sign out failed",
          description: result.message || "Please try again.",
        });
      }
    });
  };

  const handleThemeToggle = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <HeaderContainer className='justify-between'>
      <Breadcrumb>
        <BreadcrumbList className='items-center text-[14px] text-foreground sm:gap-0'>
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <BreadcrumbLink asChild>
                  <button
                    type='button'
                    aria-label='Open navigation menu'
                    className='bg-transparent p-0 m-0 border-none outline-none focus-visible:ring-2 focus-visible:ring-border-highlight rounded-full'
                  >
                    <HeaderLogo />
                  </button>
                </BreadcrumbLink>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='start'
                sideOffset={6}
                className='min-w-[160px] p-1'
              >
                <DropdownMenuItem
                  disabled={isSigningOut}
                  onSelect={() => {
                    if (!isSigningOut) {
                      handleSignOut();
                    }
                  }}
                >
                  <Icon name='HandWaveFillIcon' className='text-icon-light' />
                  Sign out
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleThemeToggle}>
                  <Icon
                    name='CircleLeftHalfFilledRightHalfStripedHorizontalIcon'
                    className='text-icon-light'
                  />
                  Toggle theme
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>
          {/* <BreadcrumbSeparator className='text-neutral-400/50 pt-0.5 dark:text-neutral-700 [&>svg]:!size-5 ml-0.5 mr-[-4px] '>
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
          </BreadcrumbItem> */}
        </BreadcrumbList>
      </Breadcrumb>
      {!activeTicketId || timerState === "stopped" ? (
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
      ) : (
        <button
          type='button'
          className='bg-card shadow-xs border-border-highlight dark:border-white/2 border rounded-sm h-[24px] hover:bg-base transition-all duration-200 ease-out cursor-pointer scale-100 absolute left-1/2 -translate-x-1/2 flex items-center translate-y-[0px] hover:translate-y-[-1px] hover:shadow-lg overflow-hidden text-[14px] px-1 pr-2 gap-1 max-w-full'
        >
          <Icon
            name={
              timerState === StopWatchState.Paused
                ? "PlayFillIcon"
                : "PauseFillIcon"
            }
            className='size-3.5 text-icon-light'
          />
          <span className='text-[12px] font-mono text-orange-400 text-left pr-0.5 w-fit'>
            {formatDuration(activeElapsedSeconds)}
          </span>
          <div className='w-px self-stretch mx-1 bg-border-light' />
          <span
            className='max-w-[220px] truncate text-left'
            title={activeTicketTitle ?? undefined}
          >
            {activeTicketTitle || "Stop watch running"}
          </span>
        </button>
      )}
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
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
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
