"use client";

import { signOutAction } from "@/app/_actions/auth-actions";
import { customToast } from "@/components/custom-toast";
import { HeaderContainer, HeaderMenu } from "@/components/header/header-ui";
import { PATHS } from "@/config/paths.config";
import { useTodayFocus } from "../_hooks";
import { useStopWatchStore } from "@/store/stop-watch-store";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FocusFormDialog } from "./focus-form-dialog";
import { InsightsDialog } from "../../../../../features/insights/insights-dialog";
import { TasksHeaderActions } from "./tasks-header-actions";
import { TasksHeaderFocusDisplay } from "./tasks-header-focus-display";
import { TasksHeaderLogo } from "./tasks-header-logo";
import { TasksHeaderTimerDisplay } from "./tasks-header-timer-display";

export function TasksHeader() {
  const [focusDialogOpen, setFocusDialogOpen] = useState(false);
  const [insightsDialogOpen, setInsightsDialogOpen] = useState(false);
  const [todayFocus, setTodayFocus] = useTodayFocus();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [isSigningOut, startSignOutTransition] = useTransition();

  // Timer state selectors
  const activeTicketId = useStopWatchStore((state) => state.activeTicketId);
  const activeTicketTitle = useStopWatchStore(
    (state) => state.activeTicketTitle
  );
  const timerState = useStopWatchStore((state) => state.state);
  const activeElapsedSeconds = useStopWatchStore((state) => {
    if (!state.activeTicketId) return 0;
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
      <TasksHeaderLogo
        onSignOut={handleSignOut}
        onThemeToggle={handleThemeToggle}
        isSigningOut={isSigningOut}
      />
      {!activeTicketId || timerState === "stopped" ? (
        <TasksHeaderFocusDisplay
          todayFocus={todayFocus}
          onClick={() => setFocusDialogOpen(true)}
        />
      ) : (
        <TasksHeaderTimerDisplay
          activeTicketTitle={activeTicketTitle}
          timerState={timerState}
          activeElapsedSeconds={activeElapsedSeconds}
        />
      )}
      <HeaderMenu>
        <TasksHeaderActions
          onInsightsClick={() => setInsightsDialogOpen(true)}
        />
      </HeaderMenu>
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
