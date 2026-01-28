# Greyboard

AI-powered document creation & task management application with Kanban board, sub-tasks, and time tracking.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint - MUST pass before commits

# Supabase
pnpm supabase:types       # Generate TS types from schema
pnpm supabase:migrate     # Create migration
pnpm supabase:reset       # Reset database
```

## Tech Stack

| Category  | Technology                                                    |
| --------- | ------------------------------------------------------------- |
| Framework | Next.js 16.1.4 (App Router, Turbopack), React 19, TypeScript |
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
    _hooks/            # Route-specific hooks
    _utils/            # Route-specific utils
  _actions/            # Server actions

components/ui/         # shadcn/ui components (51 components)
features/              # Feature modules (primary code location)
config/                # *.config.ts files for constants
hooks/                 # General-purpose hooks
lib/                   # Services, schemas, utilities
store/                 # Zustand stores
types/                 # TypeScript type definitions
```

## State Management

| Type                           | Use Case                                             |
| ------------------------------ | ---------------------------------------------------- |
| useState/useReducer            | Component-local state                                |
| localStorage (useLocalStorage) | UI prefs, board state, projects (cross-tab sync)     |
| Zustand                        | Timer store, board actions store                     |
| React Context                  | Theme, auth                                          |
| Supabase                       | User auth, files (Note: Tasks use localStorage only) |

## Code Philosophy

**Optimize for clarity.** Ask: "Will this be clear to someone reading it for the first time?"

- Self-documenting code over clever code
- Options objects over positional parameters when meaning isn't obvious
- Precise naming - function names reflect full behavior

## Core Principles

### YAGNI
Build only what's requested. No "just in case" features, speculative infrastructure, or premature abstractions.

### KISS
Simplest solution that works. No over-engineering or unnecessary abstractions.

### Separation of Concerns

| Layer | Location                                 | Responsibility                       |
| ----- | ---------------------------------------- | ------------------------------------ |
| UI    | `components/`, `features/**/components/` | Rendering, props (~100 lines max)    |
| Hooks | `hooks/`, `features/**/hooks/`           | Stateful logic, data fetching        |
| Logic | `lib/`, `**/utils/`                      | Pure functions, no React deps        |
| Data  | `_actions/`, hooks with storage          | Isolated from presentation           |

**Extract when:** Component >100 lines, 3+ useMemo/useCallback for business logic, reusable logic, needs unit testing.

## Naming Conventions

| Type        | Convention                    |
| ----------- | ----------------------------- |
| Pages       | `page.tsx`                    |
| Actions     | `{feature}-server-actions.ts` |
| Schemas     | `{feature}.schema.ts`         |
| Constants   | `{feature}.config.ts`         |
| Components  | `kebab-case.tsx`              |
| Route UI    | `_components/`                |

**Path aliases:** `@/*` maps to root (`@/components/ui/*`, `@/lib/utils`, `@/hooks/*`)

**Icons:** Lucide React (primary), `@feel-good/icons` package

## Import Conventions

```typescript
// ✅ Type imports
import { useState, type KeyboardEvent } from "react";

// ❌ Don't
import React from "react"; // then React.KeyboardEvent
```

## Features Pattern

Feature modules in `/features/` are self-contained units:

```
features/feature-name/
  components/      # Feature-specific UI
  hooks/           # Feature-specific hooks
  utils/           # Feature-specific utilities
  index.ts         # Public API exports
```

**Current features:** `kanban-board`, `ticket-card`, `ticket-form`, `project-select`, `sub-task`, `sub-task-list`, `insights`, `task-board-core`, `task-list`, `timer`

**When to create:** Cohesive functionality with 3+ components, needs isolated hooks/utils, reusable across routes.

## Key Hooks

**General:** `use-local-storage` (SSR-safe, cross-tab), `use-dialog-auto-save`, `use-focus-management`, `use-keyboard-submit`, `use-debounced-callback`

**Feature-specific:** `use-board-state`, `use-board-dnd`, `use-board-form`, `use-projects`, `use-timer-elapsed-time`

## localStorage Keys

All keys are centralized in `lib/storage-keys.ts` with prefix `docgen.v1.*`

## Pre-Implementation Checklist

1. Imports correct and minimal, type imports used
2. Hooks follow best practices (deps, memoization)
3. Custom hooks have JSDoc with purpose, params, returns, example
4. Explicit TypeScript types (no implicit any)
5. Components under ~100 lines; logic extracted

## Performance & Security

**Performance:** Turbopack dev builds, React 19 batching, optimistic DnD updates

**Security:** `NEXT_PUBLIC_` prefix for client env vars, Supabase RLS, Zod validation

See `DEPLOYMENT.md` for Vercel deployment configuration.

---

**Response format:** Always provide a copy-paste commit message at the end.
