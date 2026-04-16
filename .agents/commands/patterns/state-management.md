---
name: State Management Pattern
category: Architecture
applies_to: [state, hooks, stores]
updated: 2026-01-14
documented_in: CLAUDE.md
---

# State Management Pattern

This document defines when to use each state management solution in the application.

## Overview

The application uses a **multi-layered state management strategy** with clear separation based on data scope and persistence needs.

**Available Solutions:**
1. **localStorage** (via `useLocalStorage` hook) - Persistent, cross-session data
2. **Zustand** (global stores) - Shared client-side state across components
3. **React Context** - External library wrappers and providers
4. **useState** - Ephemeral UI state scoped to components

```
Architecture Layers:

┌─────────────────────────────────────────┐
│ localStorage (useLocalStorage)          │
│ • Projects, Board state, Filters        │
│ • Cross-tab sync, SSR-safe              │
│ • Versioned keys for migrations         │
└─────────────────────────────────────────┘
           ↓ persistence
┌─────────────────────────────────────────┐
│ Zustand Stores (stop-watch-store.ts)    │
│ • Active timer state                    │
│ • Global access, manual persistence     │
└─────────────────────────────────────────┘
           ↓ global state
┌─────────────────────────────────────────┐
│ React Context (providers/)              │
│ • Theme, Auth wrappers                  │
│ • External library integration          │
└─────────────────────────────────────────┘
           ↓ scoped state
┌─────────────────────────────────────────┐
│ useState (component-local)              │
│ • Dialog open/close, dropdown state     │
│ • Ephemeral UI state                    │
└─────────────────────────────────────────┘
```

---

## Decision Matrix

| Use Case | Solution | Persistence | Scope | Example |
|----------|----------|-------------|-------|---------|
| Multi-session user data | localStorage | Permanent | Global | Projects, Board state |
| User preferences | localStorage | Permanent | Global | Theme, Today focus |
| Filters & selections | localStorage | Session | Global | Project filter |
| Global timer/stopwatch | Zustand | Manual | Global | Active task timer |
| Cross-component state | Zustand | Optional | Global | Shared form state |
| External library setup | React Context | N/A | App-wide | Theme, Auth |
| Dialog visibility | useState | None | Component | isOpen, isFormOpen |
| Dropdown/menu state | useState | None | Component | searchQuery, open |
| Form input state | React Hook Form | None | Component | Form fields |

**Quick Decision Tree:**
1. **Needs to persist across sessions?** → Use **localStorage**
2. **Shared across distant components?** → Use **Zustand**
3. **External library wrapper?** → Use **React Context**
4. **Component-local UI state?** → Use **useState**

---

## localStorage Pattern

### When to Use

✅ **USE localStorage for:**
- User data that persists across sessions (projects, board state)
- User preferences (theme, layout settings)
- Filters and selections (project filter, last selected project)
- Draft data (sub-task drafts, form auto-save)
- Cross-tab synchronization needed

❌ **DON'T use localStorage for:**
- Sensitive data (passwords, tokens) - use secure storage
- Large datasets (>5MB) - consider IndexedDB
- Temporary UI state (dialog open/close)
- Data that changes frequently (every keystroke)

### Storage Key Naming Convention

**Format:** `{APP_PREFIX}.{VERSION}.{CATEGORY}.{KEY}`

```typescript
// ✅ CORRECT: Centralized in lib/storage-keys.ts
const STORAGE_KEYS = {
  TASKS: {
    BOARD_STATE: "docgen.v1.tasks.board-state",
    PROJECTS: "docgen.v1.tasks.projects",
    PROJECT_FILTER: "docgen.v1.tasks.project-filter",
    LAST_SELECTED_PROJECT: "docgen.v1.tasks.last-selected-project",
    TICKET_FORM_SUBTASKS: "docgen.v1.tasks.ticket-form-subtasks",
  },
  UI: {
    TODAY_FOCUS: "docgen.v1.ui.today-focus",
    THEME: "theme", // External (next-themes)
  },
} as const;

// Helper function
export function getStorageKey(
  category: keyof typeof STORAGE_KEYS,
  key: string
): string {
  return (STORAGE_KEYS[category] as any)[key];
}
```

**Naming Rules:**
- Prefix: `docgen` (app identifier)
- Version: `v1` (enables future migrations)
- Category: `tasks`, `ui` (feature grouping)
- Key: Descriptive name (kebab-case)

### Usage Pattern

```typescript
// ✅ CORRECT: Use useLocalStorage hook
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

function Component() {
  const [projects, setProjects, clearProjects] = useLocalStorage<Project[]>(
    getStorageKey("TASKS", "PROJECTS"),
    [] // default value
  );

  // Automatically syncs across tabs
  // SSR-safe (loads on client mount)
  // Handles JSON serialization
}
```

### Cross-Tab Synchronization

**Automatic:** `useLocalStorage` handles cross-tab sync via:
1. `storage` event (cross-tab changes)
2. Custom `local-storage-change` event (same-tab changes)

```typescript
// ✅ CORRECT: No extra work needed
const [value, setValue] = useLocalStorage("key", defaultValue);

// Changes sync automatically:
// Tab 1: setValue("new value")
// Tab 2: value updates automatically
```

### SSR Safety

```typescript
// ✅ CORRECT: useLocalStorage is SSR-safe
const [value, setValue] = useLocalStorage("key", defaultValue);
// - Initializes with defaultValue on server
// - Loads from localStorage on client mount
// - No hydration mismatch
```

### YAGNI Principle

**Only add storage keys when needed:**

```typescript
// ❌ WRONG: Adding keys speculatively
const STORAGE_KEYS = {
  TASKS: {
    BOARD_STATE: "...",
    PROJECTS: "...",
    // Don't add these until actually implemented:
    // TASK_TEMPLATES: "...",
    // TASK_HISTORY: "...",
    // TASK_ARCHIVED: "...",
  },
};

// ✅ CORRECT: Add keys only when feature is built
const STORAGE_KEYS = {
  TASKS: {
    BOARD_STATE: "...",
    PROJECTS: "...",
    // Add TASK_TEMPLATES when implementing templates feature
  },
};
```

---

## Zustand Pattern

### When to Use

✅ **USE Zustand for:**
- Global state shared across distant components
- State that doesn't need persistence (or needs manual persistence)
- Timer/stopwatch state
- Complex state logic with actions

❌ **DON'T use Zustand for:**
- State that needs automatic persistence → Use localStorage
- Component-local state → Use useState
- External library setup → Use React Context

### Store Structure

```typescript
// ✅ CORRECT: /store/stop-watch-store.ts
import { create } from "zustand";

// State type
type TimerState = "Stopped" | "Running" | "Paused";

interface StopWatchStore {
  // State
  state: TimerState;
  activeTicketId: string | null;
  activeTicketTitle: string | null;
  startTime: number | null;
  accumulatedTime: number;
  _renderTick: number;
  _hasHydrated: boolean;

  // Actions (public)
  startTimer: (ticketId: string, title: string) => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  resetTimer: (ticketId?: string) => void;

  // Selectors (public)
  getElapsedTime: () => number;
  isTimerActive: (ticketId: string) => boolean;

  // Internal methods (private)
  _persistState: () => void;
  _hydrate: () => void;
}

export const useStopWatchStore = create<StopWatchStore>((set, get) => ({
  // Default state
  state: "Stopped",
  activeTicketId: null,
  activeTicketTitle: null,
  startTime: null,
  accumulatedTime: 0,
  _renderTick: 0,
  _hasHydrated: false,

  // Actions
  startTimer: (ticketId, title) => {
    set({
      state: "Running",
      activeTicketId: ticketId,
      activeTicketTitle: title,
      startTime: Date.now(),
      accumulatedTime: 0,
    });
    get()._persistState();
  },

  pauseTimer: () => {
    const elapsed = get().getElapsedTime();
    set({
      state: "Paused",
      accumulatedTime: elapsed,
      startTime: null,
    });
    get()._persistState();
  },

  stopTimer: () => {
    set({
      state: "Stopped",
      activeTicketId: null,
      activeTicketTitle: null,
      startTime: null,
      accumulatedTime: 0,
    });
    get()._persistState();
  },

  // Selectors
  getElapsedTime: () => {
    const { state, startTime, accumulatedTime } = get();
    if (state === "Running" && startTime) {
      return accumulatedTime + (Date.now() - startTime);
    }
    return accumulatedTime;
  },

  isTimerActive: (ticketId) => {
    return get().activeTicketId === ticketId;
  },

  // Internal methods
  _persistState: () => {
    const { state, activeTicketId, activeTicketTitle, accumulatedTime } = get();
    localStorage.setItem(
      getStorageKey("TASKS", "TIMER_STATE"),
      JSON.stringify({
        state: state === "Running" ? "Paused" : state, // Reset running to paused
        activeTicketId,
        activeTicketTitle,
        accumulatedTime,
      })
    );
  },

  _hydrate: () => {
    if (get()._hasHydrated) return;

    const stored = localStorage.getItem(getStorageKey("TASKS", "TIMER_STATE"));
    if (stored) {
      const parsed = JSON.parse(stored);
      set({ ...parsed, _hasHydrated: true });
    }
  },
}));
```

### Naming Conventions

**Public methods:** `camelCase`
```typescript
startTimer()
pauseTimer()
getElapsedTime()
```

**Private/internal methods:** `_prefixUnderscore`
```typescript
_persistState()
_hydrate()
_hasHydrated
_renderTick
```

**Why underscore prefix:**
- Signals "internal use only"
- Prevents accidental usage from components
- Clear separation of public API

### Manual Persistence

```typescript
// ✅ CORRECT: Call _persistState() after mutations
startTimer: (ticketId, title) => {
  set({ /* state changes */ });
  get()._persistState(); // Save to localStorage
}
```

**Why manual persistence:**
- More control over when to save
- Can transform state before saving (e.g., reset Running → Paused)
- Avoids unnecessary writes

### Hydration Pattern

```typescript
// ✅ CORRECT: Hydrate once on component mount
function Component() {
  const store = useStopWatchStore();

  useEffect(() => {
    store._hydrate();
  }, []);

  // Use store...
}
```

**Hydration checks:**
- `_hasHydrated` flag prevents multiple hydrations
- Transforms state on load (e.g., reset running timers to paused)

---

## React Context Pattern

### When to Use

✅ **USE React Context for:**
- External library wrappers (next-themes, auth clients)
- Global providers (theme, auth)
- Compound providers (wrapping multiple providers)

❌ **DON'T use React Context for:**
- Application state → Use localStorage or Zustand
- Ephemeral UI state → Use useState
- Cross-tab sync needed → Use localStorage

### Provider Structure

```typescript
// ✅ CORRECT: /components/providers/root-provider.tsx
"use client";

import { ThemeProvider } from "next-themes";
import { ReactQueryProvider } from "./react-query-provider";
import { Toaster } from "@/components/ui/toast";

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ThemeWrapper>
          {children}
          <Toaster />
        </ThemeWrapper>
      </ThemeProvider>
    </ReactQueryProvider>
  );
}

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  useThemeToggle(); // Run theme-related setup
  return <>{children}</>;
}
```

### Compound Provider Pattern

**When you have multiple providers:**

```typescript
// ✅ CORRECT: Nest providers in composition
export function HomepageProviders({ children }: Props) {
  return (
    <ProviderA>
      <ProviderB>
        <ProviderC>
          {children}
        </ProviderC>
      </ProviderB>
    </ProviderA>
  );
}
```

**Reference:** See `page-view-providers-pattern.md` for full pattern

---

## useState Pattern

### When to Use

✅ **USE useState for:**
- Dialog/modal visibility (isOpen, isFormOpen)
- Dropdown/menu state (open, searchQuery)
- Temporary form state (showSubTasks)
- UI interactions (highlightedIndex, activeId)
- Component-scoped state that doesn't need sharing

❌ **DON'T use useState for:**
- State shared across components → Use Zustand
- State that persists → Use localStorage
- Form data → Use React Hook Form

### Usage Pattern

```typescript
// ✅ CORRECT: Component-local UI state
function TasksHeader() {
  const [focusDialogOpen, setFocusDialogOpen] = useState(false);
  const [insightsDialogOpen, setInsightsDialogOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setFocusDialogOpen(true)}>Focus</Button>
      <FocusFormDialog
        open={focusDialogOpen}
        onOpenChange={setFocusDialogOpen}
      />
    </>
  );
}
```

---

## AI Agent Checklist

When adding state to the application, follow this decision tree:

### Step 1: Determine Persistence Needs

- [ ] **Does state need to persist across sessions?**
  - YES → Use **localStorage**
  - NO → Continue to Step 2

### Step 2: Determine Scope

- [ ] **Is state shared across distant components?**
  - YES → Use **Zustand**
  - NO → Continue to Step 3

### Step 3: Determine Purpose

- [ ] **Is this an external library wrapper?**
  - YES → Use **React Context**
  - NO → Use **useState**

### localStorage Implementation

- [ ] Add key to `/lib/storage-keys.ts` under appropriate category
- [ ] Use `getStorageKey()` helper to retrieve key
- [ ] Use `useLocalStorage` hook (handles SSR, cross-tab sync)
- [ ] Provide sensible default value
- [ ] Document key purpose in STORAGE_KEYS constant

### Zustand Implementation

- [ ] Create store file: `/store/{feature}-store.ts`
- [ ] Define state interface with types
- [ ] Use `_prefix` for internal methods
- [ ] Implement `_persistState()` if persistence needed
- [ ] Implement `_hydrate()` for loading persisted state
- [ ] Call `_persistState()` after each mutation
- [ ] Add `_hasHydrated` flag to prevent re-hydration

### React Context Implementation

- [ ] Create provider in `/components/providers/`
- [ ] Use `"use client"` directive
- [ ] Wrap only necessary children (not entire app if avoidable)
- [ ] Compose with other providers in RootProvider if needed

### useState Implementation

- [ ] Use in component that owns the state
- [ ] Pass setter to children via props (if needed)
- [ ] Don't lift state until actually needed by parent

---

## Testing Requirements

### localStorage State

```typescript
it("should persist to localStorage", () => {
  const { result } = renderHook(() => useProjects());

  act(() => {
    result.current.addProject("New Project", "blue");
  });

  const stored = localStorage.getItem(getStorageKey("TASKS", "PROJECTS"));
  expect(JSON.parse(stored!)).toHaveLength(1);
});
```

### Zustand State

```typescript
it("should update timer state", () => {
  const { startTimer, getElapsedTime } = useStopWatchStore.getState();

  startTimer("ticket-1", "Task Title");

  expect(useStopWatchStore.getState().activeTicketId).toBe("ticket-1");
  expect(getElapsedTime()).toBeGreaterThan(0);
});
```

### React Context

```typescript
it("should provide theme context", () => {
  const { result } = renderHook(() => useTheme(), {
    wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
  });

  expect(result.current.theme).toBeDefined();
});
```

---

## ESLint / TypeScript Rules

### Type Safety for Storage Keys

```typescript
// ✅ CORRECT: Type-safe key access
const STORAGE_KEYS = {
  TASKS: { ... },
  UI: { ... },
} as const;

export function getStorageKey(
  category: keyof typeof STORAGE_KEYS,
  key: string
): string {
  // TypeScript ensures category is valid
}
```

### Zustand Store Types

```typescript
// ✅ CORRECT: Explicit interface
interface StopWatchStore {
  state: TimerState;
  startTimer: (id: string, title: string) => void;
  // ...
}

export const useStopWatchStore = create<StopWatchStore>((set, get) => ({
  // Implementation
}));
```

---

## Anti-Patterns

### ❌ DON'T: Use localStorage for Sensitive Data

```typescript
// ❌ WRONG: Passwords, tokens, API keys
localStorage.setItem("password", userPassword);
localStorage.setItem("api_token", token);

// ✅ CORRECT: Use secure storage or server-side sessions
```

### ❌ DON'T: Create Zustand Store for Component-Local State

```typescript
// ❌ WRONG: Overkill for dialog state
const useDialogStore = create((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
}));

// ✅ CORRECT: Use useState
const [isOpen, setIsOpen] = useState(false);
```

### ❌ DON'T: Skip getStorageKey Helper

```typescript
// ❌ WRONG: Hardcoded key strings
const [value, setValue] = useLocalStorage("docgen.v1.tasks.projects", []);

// ✅ CORRECT: Use helper
const [value, setValue] = useLocalStorage(
  getStorageKey("TASKS", "PROJECTS"),
  []
);
```

### ❌ DON'T: Add Storage Keys Speculatively

```typescript
// ❌ WRONG: YAGNI violation
const STORAGE_KEYS = {
  TASKS: {
    BOARD_STATE: "...",
    PROJECTS: "...",
    // Not implemented yet:
    TASK_TEMPLATES: "...",
    TASK_ARCHIVED: "...",
  },
};

// ✅ CORRECT: Add only when implementing
const STORAGE_KEYS = {
  TASKS: {
    BOARD_STATE: "...",
    PROJECTS: "...",
    // Will add TASK_TEMPLATES when feature is built
  },
};
```

---

## Reference Examples

### localStorage Usage
- `/hooks/use-local-storage.ts` - Foundation pattern
- `/hooks/use-projects.ts` - CRUD with localStorage
- `/lib/storage-keys.ts` - Centralized keys

### Zustand Usage
- `/store/stop-watch-store.ts` - Timer state with manual persistence

### React Context Usage
- `/components/providers/root-provider.tsx` - Compound provider
- `/components/providers/theme-provider.tsx` - External library wrapper

### useState Usage
- `/components/tasks/tasks-header.tsx` - Dialog visibility state
- `/app/(protected)/dashboard/tasks/_components/board.tsx` - UI interaction state

---

## Summary

**Key Takeaways:**
1. ✅ **localStorage** - Persistent user data (projects, preferences, filters)
2. ✅ **Zustand** - Global cross-component state (timer, shared state)
3. ✅ **React Context** - External library wrappers (theme, auth)
4. ✅ **useState** - Ephemeral component-local UI (dialogs, dropdowns)
5. ✅ **Storage keys** - Use `getStorageKey()` helper, add to STORAGE_KEYS
6. ✅ **YAGNI** - Only add keys/stores when actually implementing features
7. ✅ **Type safety** - Use TypeScript for all state management
8. ✅ **Testing** - Test persistence, synchronization, and state updates

**Decision priority:**
1. Needs persistence? → localStorage
2. Shared globally? → Zustand
3. External wrapper? → Context
4. Component-local? → useState
