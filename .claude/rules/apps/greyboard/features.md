---
paths:
  - "apps/greyboard/features/**/*"
---

# Greyboard Feature Module Rules

## Feature Structure

Each feature in `/features/` is a self-contained module:

```
features/feature-name/
  components/           # Feature-specific UI components
    feature-component.tsx
  hooks/               # Feature-specific hooks
    use-feature-state.ts
  utils/               # Feature-specific utilities
    feature-helpers.ts
  types.ts             # Feature-specific types (if needed)
  index.ts             # Public API exports
```

## Public API (index.ts)

Only export what other modules need:

```typescript
// features/ticket-card/index.ts
export { TicketCard } from "./components/ticket-card";
export type { TicketCardProps } from "./components/ticket-card";
// Don't export internal components/hooks
```

## Current Features

| Feature           | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `kanban-board`    | Board layout, columns, drag-drop container |
| `ticket-card`     | Individual ticket display and actions      |
| `ticket-form`     | Create/edit ticket dialog                  |
| `project-select`  | Project CRUD, selection dropdown           |
| `sub-task`        | Individual sub-task row component          |
| `sub-task-list`   | Sub-task list container with add/remove    |
| `insights`        | Analytics dialog with charts               |
| `task-board-core` | Shared board logic, context, hooks         |
| `task-list`       | List view layout components                |
| `timer`           | Stopwatch store, display, utilities        |

## When to Create a Feature

Create a new feature when:
- Cohesive functionality with 3+ components
- Needs isolated hooks/utils
- Reusable across routes
- Has its own state management needs

## Cross-Feature Dependencies

- Features can import from `task-board-core` (shared board logic)
- Avoid circular dependencies between features
- Use shared hooks from `/hooks/` for common patterns

## Feature Hooks

Feature hooks follow JSDoc pattern:

```typescript
/**
 * Manages board drag-and-drop state and handlers.
 * @param board - Current board state
 * @param onBoardChange - Callback when board changes
 * @returns DnD sensors, handlers, and active state
 * @example
 * const { sensors, handleDragEnd, activeId } = useBoardDnd(board, setBoard);
 */
export function useBoardDnd(board: Board, onBoardChange: (board: Board) => void) {
  // ...
}
```
