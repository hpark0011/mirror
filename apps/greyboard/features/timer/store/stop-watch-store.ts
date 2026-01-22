import { create } from "zustand";
import { getStorageKey } from "@/lib/storage-keys";

export enum StopWatchState {
  Stopped = "stopped",
  Running = "running",
  Paused = "paused",
}

export interface TimerState {
  activeTicketId: string | null;
  activeTicketTitle: string | null;
  startTime: number | null; // Timestamp when timer started/resumed
  accumulatedTime: number; // Seconds accumulated before pause
  state: StopWatchState;
}

export interface StopWatchStore extends TimerState {
  // Internal interval ID (not persisted)
  intervalId: ReturnType<typeof setInterval> | null;
  _hasHydrated: boolean;
  _renderTick: number; // Counter to force re-renders reliably

  // Actions
  startTimer: (ticketId: string, ticketTitle: string) => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  resetTimer: (ticketId: string) => void;
  updateActiveTicketTitle: (ticketId: string, newTitle: string) => void;

  // Selectors
  getElapsedTime: (ticketId: string) => number;
  isTimerActive: (ticketId: string) => boolean;
  getTimerState: (ticketId: string) => StopWatchState;

  // Hydration
  _hydrate: () => void;

  // Internal
  _tick: () => void;
  _clearInterval: () => void;
  _persistState: () => void;
}

/**
 * Loads timer state from localStorage
 */
function loadPersistedState(): Partial<TimerState> {
  if (typeof window === "undefined") return {};

  try {
    const key = getStorageKey("TASKS", "TIMER_STATE");
    const stored = localStorage.getItem(key);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as Partial<TimerState>;
    const normalized: TimerState = {
      activeTicketId: parsed.activeTicketId ?? null,
      activeTicketTitle: parsed.activeTicketTitle ?? null,
      startTime: parsed.startTime ?? null,
      accumulatedTime: parsed.accumulatedTime ?? 0,
      state: parsed.state ?? StopWatchState.Stopped,
    };

    // Reset running timers on page load (hydration strategy)
    if (normalized.state === StopWatchState.Running) {
      return {
        activeTicketId: normalized.activeTicketId,
        activeTicketTitle: normalized.activeTicketTitle,
        startTime: null,
        accumulatedTime: normalized.accumulatedTime,
        state: StopWatchState.Stopped,
      };
    }

    return normalized;
  } catch (error) {
    console.error("Error loading timer state:", error);
    return {};
  }
}

/**
 * Saves timer state to localStorage
 */
function persistState(state: TimerState): void {
  if (typeof window === "undefined") return;

  try {
    const key = getStorageKey("TASKS", "TIMER_STATE");
    const toStore: TimerState = {
      activeTicketId: state.activeTicketId,
      activeTicketTitle: state.activeTicketTitle,
      startTime: state.startTime,
      accumulatedTime: state.accumulatedTime,
      state: state.state,
    };
    localStorage.setItem(key, JSON.stringify(toStore));
  } catch (error) {
    console.error("Error persisting timer state:", error);
  }
}

export const useStopWatchStore = create<StopWatchStore>((set, get) => ({
  // Initial state (same on server and client for hydration)
  activeTicketId: null,
  activeTicketTitle: null,
  startTime: null,
  accumulatedTime: 0,
  state: StopWatchState.Stopped,
  intervalId: null,
  _hasHydrated: false,
  _renderTick: 0,

  // Actions
  startTimer: (ticketId: string, ticketTitle: string) => {
    const state = get();

    // Single timer guard: Stop any running timer first
    if (state.activeTicketId && state.activeTicketId !== ticketId) {
      get().stopTimer();
    }

    // Clear any existing interval
    get()._clearInterval();

    // Start new timer
    const now = Date.now();
    const newIntervalId = setInterval(() => {
      get()._tick();
    }, 1000);

    set({
      activeTicketId: ticketId,
      activeTicketTitle: ticketTitle,
      startTime: now,
      accumulatedTime: state.activeTicketId === ticketId ? state.accumulatedTime : 0,
      state: StopWatchState.Running,
      intervalId: newIntervalId,
    });

    // Persist on transition
    get()._persistState();
  },

  pauseTimer: () => {
    const state = get();
    if (state.state !== StopWatchState.Running) return;

    // Calculate elapsed time since start and add to accumulated
    const now = Date.now();
    const elapsedSinceStart = state.startTime
      ? Math.floor((now - state.startTime) / 1000)
      : 0;

    get()._clearInterval();

    set({
      startTime: null,
      accumulatedTime: state.accumulatedTime + elapsedSinceStart,
      state: StopWatchState.Paused,
      intervalId: null,
    });

    // Persist on transition
    get()._persistState();
  },

  stopTimer: () => {
    get()._clearInterval();

    set({
      activeTicketId: null,
      activeTicketTitle: null,
      startTime: null,
      accumulatedTime: 0,
      state: StopWatchState.Stopped,
      intervalId: null,
    });

    // Persist on transition
    get()._persistState();
  },

  resetTimer: (ticketId: string) => {
    const state = get();

    // If this is the active timer, stop it
    if (state.activeTicketId === ticketId) {
      get().stopTimer();
    }
  },

  updateActiveTicketTitle: (ticketId: string, newTitle: string) => {
    const state = get();

    // Only update if this is the currently active timer
    if (state.activeTicketId === ticketId) {
      set({ activeTicketTitle: newTitle });
      get()._persistState();
    }
  },

  // Selectors
  getElapsedTime: (ticketId: string) => {
    const state = get();
    if (state.activeTicketId !== ticketId) return 0;

    if (state.state === StopWatchState.Running && state.startTime) {
      // Calculate elapsed time using timestamp diff (accurate even if throttled)
      const now = Date.now();
      const elapsedSinceStart = Math.floor((now - state.startTime) / 1000);
      return state.accumulatedTime + elapsedSinceStart;
    }

    // Paused or stopped
    return state.accumulatedTime;
  },

  isTimerActive: (ticketId: string) => {
    const state = get();
    return state.activeTicketId === ticketId;
  },

  getTimerState: (ticketId: string) => {
    const state = get();
    if (state.activeTicketId !== ticketId) return StopWatchState.Stopped;
    return state.state;
  },

  // Internal methods
  _tick: () => {
    // Force re-render for UI update by incrementing counter
    // The actual elapsed time is calculated in getElapsedTime
    set((state) => ({ _renderTick: state._renderTick + 1 }));
  },

  _clearInterval: () => {
    const state = get();
    if (state.intervalId) {
      clearInterval(state.intervalId);
    }
  },

  _persistState: () => {
    const state = get();
    persistState({
      activeTicketId: state.activeTicketId,
      activeTicketTitle: state.activeTicketTitle,
      startTime: state.startTime,
      accumulatedTime: state.accumulatedTime,
      state: state.state,
    });
  },

  _hydrate: () => {
    // Only hydrate once
    if (get()._hasHydrated) return;

    const loaded = loadPersistedState();
    set({ ...loaded, _hasHydrated: true });
  },
}));
