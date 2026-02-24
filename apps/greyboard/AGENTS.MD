# CLAUDE.md

## Application Overview

AI-powered document creation & task management application.

## Commands

```bash
pnpm dev        # Start development server with Turbopack (http://localhost:3000)
pnpm build      # Build production application
pnpm start      # Run production server
pnpm lint       # Run ESLint - MUST pass before commits
```

## Architecture

### Tech Stack

- **Next.js 15.4.10** with App Router and Turbopack
- **React 19** with strict TypeScript
- **Browser localStorage** for runtime task/project persistence (no backend auth)
- **Tailwind CSS 4** with CSS variables design system
- **shadcn/ui** components (New York style) with Radix UI
- **@dnd-kit** for drag-and-drop task management
- **React Hook Form + Zod** for forms and validation
- **Zustand** for global state management (timer/stopwatch)
- **Framer Motion** for animations (insights page)
- **Recharts** for data visualization

### Project Structure

```
app/
   (auth)/           # Legacy auth URLs (redirect to /dashboard/tasks)
   (protected)/      # Dashboard routes (no auth gating)
      dashboard/
          files/     # Document upload and management
          tasks/     # Task board with Kanban functionality
   insights/         # Analytics dashboard
   _actions/         # Server actions

components/          # UI components (shadcn, tasks, files, header, layout, navigation, providers)
config/              # Centralized config files ({feature}.config.ts)
hooks/               # Custom React hooks (18+)
lib/                 # Business logic, schemas, storage utilities
store/               # Zustand state management
styles/              # CSS variable design tokens
types/               # TypeScript type definitions
```

### Data Persistence

Greyboard web is anonymous and local-only. All data persists in browser `localStorage`.

### State Management

- **useState/useReducer**: Component-local state
- **localStorage** (via `useLocalStorage` hook): Board state, projects, UI preferences, cross-tab sync
- **Zustand** (`store/`): Timer/stopwatch global state
- **React Context** (`providers/`): Theme
- **No runtime backend auth/database**

### Route Access

- `/`, `/sign-in`, `/sign-up`, `/auth/callback` redirect to `/dashboard/tasks`
- Dashboard routes are accessible without authentication

## Naming Conventions

- Pages: `page.tsx`
- Loaders: `{feature}-page.loader.ts`
- Actions: `{feature}-server-actions.ts`
- Schemas: `{feature}.schema.ts`
- Constants: `{feature}.config.ts`
- Components: `kebab-case.tsx`

### Per-Route Organization

- UI components: `_components/`
- Client utilities: `_lib/`
- Server-only utilities: `_lib/server/`

## Respond Format

- Always give me a commit message that I could copy and paste at the end of your response.
