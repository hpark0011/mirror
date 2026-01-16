# CLAUDE.md

AI-powered document creation & task management application with Kanban board, sub-tasks, and time tracking.

## Commands

```bash
# Development
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm start        # Run production server
pnpm lint         # ESLint - MUST pass before commits

# Supabase
pnpm supabase:types       # Generate TS types from schema
pnpm supabase:migrate     # Create migration
pnpm supabase:migrate:up  # Apply migrations
pnpm supabase:reset       # Reset database
pnpm supabase:deploy      # Deploy to production
```

## Code Philosophy

**Optimize for clarity.** Ask: "Will this be clear to someone reading it for the first time?"

- Self-documenting code over clever code
- Options objects over positional parameters when meaning isn't obvious
- Precise naming - function names reflect full behavior
- Simple, intuitive APIs at call sites

## Tech Stack

| Category  | Technology                                                    |
| --------- | ------------------------------------------------------------- |
| Framework | Next.js 15.4.10 (App Router, Turbopack), React 19, TypeScript |
| Backend   | Supabase (auth, database)                                     |
| Styling   | Tailwind CSS 4, CSS variables, shadcn/ui (New York)           |
| State     | Zustand (global), localStorage (persistence), React Context   |
| Forms     | React Hook Form + Zod                                         |
| DnD       | @dnd-kit                                                      |
| Charts    | Recharts, Framer Motion                                       |

## Project Structure

```
app/
  (auth)/              # Auth flow (sign-in, sign-up, callback)
  (protected)/dashboard/tasks/  # Kanban board page
    _components/       # Route-specific components
    _hooks/            # Route-specific hooks (ticket-form, today-focus)
    _utils/            # Route-specific utils (board-io, serialization)
    _view/             # Main view component
  _actions/            # Server actions

components/
  ui/                  # shadcn/ui components
  auth/                # Authentication forms
  header/              # Header UI
  layout/              # Layout components
  providers/           # Context providers

features/              # Feature modules (primary code location)
  kanban-board/        # Board, columns, drag-drop logic
  ticket-card/         # Ticket display and actions
  ticket-form/         # Ticket create/edit dialog
  project-select/      # Project CRUD and selection
  sub-task/            # Individual sub-task row
  sub-task-list/       # Sub-task list container
  insights/            # Analytics dialog

config/                # *.config.ts files for constants
  auth, board, insight-variants, navs, paths, routes, tasks

hooks/                 # General-purpose hooks (9 hooks)
  __tests__/           # Jest + React Testing Library

lib/
  services/            # Business logic (auth, file)
  schema/              # Zod schemas (auth, file)
  storage-keys.ts      # Centralized localStorage keys
  utils.ts, insights-utils.ts

store/                 # Zustand stores
  stop-watch-store.ts  # Timer/stopwatch state
  board-actions-store.ts  # Board import/export/clear actions

styles/                # CSS variables (primitives, components, colors, shadows)
supabase/              # Migrations, schema
types/                 # board.types.ts, file.types.ts, database.types.ts
```

## State Management

| Type                           | Use Case                                             |
| ------------------------------ | ---------------------------------------------------- |
| useState/useReducer            | Component-local state                                |
| localStorage (useLocalStorage) | UI prefs, board state, projects (cross-tab sync)     |
| Zustand                        | `useStopWatchStore` (timer), `useBoardActionsStore` (import/export/clear) |
| React Context                  | Theme, auth                                          |
| Supabase                       | User auth, files (Note: Tasks use localStorage only) |

## Key Features

### Tasks (`/dashboard/tasks`)

Kanban board with drag-and-drop (4 columns: Backlog, To Do, In Progress, Complete), projects, sub-tasks, timer, localStorage persistence, import/export, auto-save, keyboard shortcuts (Cmd+Enter).

**Features:** `kanban-board`, `ticket-card`, `ticket-form`, `sub-task`, `sub-task-list`
**Route hooks:** `useTicketForm`, `useProjectFilter`, `useTodayFocus`

### Insights (dialog)

Analytics with Recharts visualization, task stats, project breakdown, Framer Motion animations.

**Feature:** `features/insights/` with `InsightsDialog`, date picker, task list, project breakdown

### Projects

Color-coded categorization (8 colors), CRUD via `useProjects`, localStorage persistence.

### Key Hooks

**General (`/hooks/`):** `use-local-storage` (SSR-safe, cross-tab), `use-dialog-auto-save`, `use-focus-management`, `use-keyboard-submit`, `use-persisted-sub-tasks`, `use-debounced-callback`, `use-keyboard-navigation`

**Feature-specific:** `use-board-state`, `use-board-dnd`, `use-board-form` (kanban-board), `use-projects`, `use-project-selection` (project-select)

**Route-specific (`_hooks/`):** `use-ticket-form`, `use-project-filter`, `use-today-focus`

## Development Patterns

### Components

```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
<Button data-slot='submit-button' className={cn("custom-class")} />;
```

### Forms (React Hook Form + Zod)

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({ title: z.string().min(1, "Required") });
type FormData = z.infer<typeof schema>;
```

### Zustand

```typescript
import { create } from "zustand";

interface Store {
  isRunning: boolean;
  start: () => void;
}
export const useStore = create<Store>((set) => ({
  isRunning: false,
  start: () => set({ isRunning: true }),
}));
```

### Data Fetching

```tsx
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client/supabase-server";
```

### Auth

Middleware protects `/dashboard/*` and `/insights`. Supabase handles auth (magic links, OAuth). Use `getCurrentServerUser()` or `getCurrentClientUser()`.

## Code Quality

### Imports

```typescript
// ✅ DO: Type imports
import { useState, type KeyboardEvent } from "react";

// ❌ DON'T
import React from "react"; // then React.KeyboardEvent
```

### Hook Callbacks

Store callbacks in refs to avoid re-running effects:

```typescript
const callbackRef = useRef(onSubmit);
useEffect(() => {
  callbackRef.current = onSubmit;
}, [onSubmit]);
useEffect(() => {
  /* use callbackRef.current */
}, [enabled]);
```

### JSDoc Required

All custom hooks MUST have JSDoc with purpose, params, returns, example:

```typescript
/**
 * Manages focus for form inputs in dialogs.
 * @returns Refs and handlers for form fields
 * @example
 * const { handleAutoFocus, setRefs } = useFocusManagement();
 */
```

### Pre-Implementation Checklist

1. Imports correct and minimal, type imports used
2. Hooks follow best practices (deps, memoization)
3. Custom hooks have JSDoc
4. Explicit TypeScript types (no implicit any)
5. Event handlers typed
6. Edge cases handled (useEffect cleanup)
7. Components under ~100 lines; logic extracted

## Core Principles

### YAGNI

Build only what's requested. No "just in case" features, speculative infrastructure, or premature abstractions.

### KISS

Simplest solution that works. No over-engineering, unnecessary abstractions, or premature optimization.

```typescript
// ❌ Over-engineered
class StorageManager<T> {
  constructor(config, middleware, plugins) {}
}

// ✅ Simple
function getStorageKey(category: string, key: string): string {
  return `${PREFIX}.${category}.${key}`;
}
```

### Separation of Concerns

| Layer | Location                                 | Responsibility                                      |
| ----- | ---------------------------------------- | --------------------------------------------------- |
| UI    | `components/`, `features/**/components/` | Rendering, props, minimal UI state (~100 lines max) |
| Hooks | `hooks/`, `features/**/hooks/`           | Stateful logic, data fetching, side effects         |
| Logic | `lib/`, `**/utils/`                      | Pure functions, no React deps, testable             |
| Data  | `_actions/`, hooks with storage          | Isolated from presentation                          |

**Extract when:** Component >100 lines, 3+ useMemo/useCallback for business logic, reusable logic, needs unit testing.

**Before:**

```tsx
function InsightsDialog() {
  const [rawBoard] = useLocalStorage(...);
  const board = safelyDeserializeBoard(rawBoard);
  const completedTasks = useMemo(() => getTasksCompletedOnDate(...), [...]);
  // 300+ lines...
}
```

**After:**

```tsx
// hooks/use-insights-data.ts
function useInsightsData(date: Date) {
  const [rawBoard] = useLocalStorage(...);
  return { completedTasks: useMemo(...), totalDuration: useMemo(...) };
}

// Component: clean UI only
function InsightsDialog() {
  const data = useInsightsData(selectedDate);
}
```

### Implementation Guidelines

1. Ask before adding infrastructure
2. Start minimal, grow organically
3. Don't add "maybe later" code
4. Extract early when >100 lines

### Features Pattern

Feature modules in `/features/` are self-contained units:

```
features/feature-name/
  components/      # Feature-specific UI components
  hooks/           # Feature-specific hooks
  utils/           # Feature-specific utilities
  types/           # Feature-specific types (if needed)
  index.ts         # Public API exports
```

**Current features:** `kanban-board`, `ticket-card`, `ticket-form`, `project-select`, `sub-task`, `sub-task-list`, `insights`

**When to create a feature:** Cohesive functionality with 3+ components, needs isolated hooks/utils, reusable across routes.

### localStorage Keys

```typescript
// lib/storage-keys.ts
const STORAGE_KEYS = {
  TASKS: {
    BOARD_STATE: "docgen.v1.tasks.board-state",
    PROJECTS: "docgen.v1.tasks.projects",
  },
  UI: { TODAY_FOCUS: "docgen.v1.ui.today-focus", THEME: "theme" },
};
```

## Naming & Organization

| Type        | Convention                    |
| ----------- | ----------------------------- |
| Pages       | `page.tsx`                    |
| Loaders     | `{feature}-page.loader.ts`    |
| Actions     | `{feature}-server-actions.ts` |
| Schemas     | `{feature}.schema.ts`         |
| Constants   | `{feature}.config.ts`         |
| Components  | `kebab-case.tsx`              |
| Route UI    | `_components/`                |
| Route utils | `_lib/`, `_lib/server/`       |

**Path aliases:** `@/*` maps to root (`@/components/ui/*`, `@/lib/utils`, `@/hooks/*`, `@/types/*`, `@/config/*`)

**Icons:** Lucide React (primary), custom SVGs in `/icons`, `@/components/ui/icon`

## Performance & Security

**Performance:** Turbopack dev builds, standalone production, React 19 batching, optimistic DnD updates, Next.js Image optimization

**Security:** `NEXT_PUBLIC_` prefix for client env vars, Supabase RLS, server actions for mutations, Zod validation, React XSS escaping

---

**Response format:** Always provide a copy-paste commit message at the end.
