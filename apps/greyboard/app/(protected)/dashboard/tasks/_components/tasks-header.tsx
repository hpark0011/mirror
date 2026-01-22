"use client";

import { signOutAction } from "@/app/_actions/auth-actions";
import { customToast } from "@/components/custom-toast";
import { HeaderContainer } from "@/components/header/header-ui";
import { PATHS } from "@/config/paths.config";
import { InsightsDialog } from "@/features/insights";
import { useTimerElapsedTime, useStopWatchStore, TimerDisplay } from "@/features/timer";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTodayFocus } from "../_hooks";
import { FocusFormDialog } from "./focus-form-dialog";
import { TasksHeaderActions } from "./tasks-header-actions";
import { TasksHeaderFocusDisplay } from "./tasks-header-focus-display";
import { TasksHeaderLogo } from "./tasks-header-logo";

export function TasksHeader() {
  const [focusDialogOpen, setFocusDialogOpen] = useState(false);
  const [insightsDialogOpen, setInsightsDialogOpen] = useState(false);
  const [todayFocus, setTodayFocus] = useTodayFocus();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [isSigningOut, startSignOutTransition] = useTransition();

  // Timer state selectors
  const activeTicketId = useStopWatchStore((state) => state.activeTicketId);
  const activeTicketTitle = useStopWatchStore((state) =>
    state.activeTicketTitle
  );
  const timerState = useStopWatchStore((state) => state.state);
  const hydrate = useStopWatchStore((state) => state._hydrate);
  const activeElapsedSeconds = useTimerElapsedTime(activeTicketId);

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
    <HeaderContainer className="grid grid-cols-3 items-center">
      <div className="flex items-center justify-start">
        <TasksHeaderLogo
          onSignOut={handleSignOut}
          onThemeToggle={handleThemeToggle}
          isSigningOut={isSigningOut}
        />
      </div>
      <div className="flex items-center justify-center">
        {!activeTicketId || timerState === "stopped"
          ? (
            <TasksHeaderFocusDisplay
              todayFocus={todayFocus}
              onClick={() => setFocusDialogOpen(true)}
            />
          )
          : (
            <TimerDisplay
              activeTicketTitle={activeTicketTitle}
              timerState={timerState}
              activeElapsedSeconds={activeElapsedSeconds}
            />
          )}
      </div>
      <div className="flex items-center justify-end">
        <TasksHeaderActions
          onInsightsClick={() => setInsightsDialogOpen(true)}
        />
      </div>
      <FocusFormDialog
        open={focusDialogOpen}
        onOpenChange={setFocusDialogOpen}
        onSubmit={(data) => {
          setTodayFocus(data.focus);
          setFocusDialogOpen(false);
        }}
        defaultValue={todayFocus}
      />
      <InsightsDialog
        open={insightsDialogOpen}
        onOpenChange={setInsightsDialogOpen}
      />
    </HeaderContainer>
  );
}
