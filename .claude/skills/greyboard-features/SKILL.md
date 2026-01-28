# Greyboard Features Skill

Detailed documentation for Greyboard's feature implementations.

## Tasks Feature (`/dashboard/tasks`)

### Overview

Kanban board with drag-and-drop functionality:
- 4 columns: Backlog, To Do, In Progress, Complete
- Project categorization with color coding
- Sub-tasks per ticket
- Time tracking with stopwatch
- localStorage persistence
- Import/export functionality

### Key Components

| Component | Feature | Purpose |
| --------- | ------- | ------- |
| `KanbanBoard` | `kanban-board` | Main board container with DnD context |
| `BoardColumn` | `kanban-board` | Individual column with droppable area |
| `TicketCard` | `ticket-card` | Draggable ticket with actions |
| `TicketForm` | `ticket-form` | Create/edit dialog with validation |
| `SubTaskList` | `sub-task-list` | Sub-task management within tickets |
| `SubTask` | `sub-task` | Individual sub-task row |
| `Timer` | `timer` | Stopwatch display and controls |

### Data Flow

```
localStorage (BOARD_STATE)
    ↓
useLocalStorage hook
    ↓
useBoardState (task-board-core)
    ↓
KanbanBoard component
    ↓
BoardColumn components
    ↓
TicketCard components
```

### Route Hooks

| Hook | Purpose |
| ---- | ------- |
| `useTicketForm` | Manages ticket form dialog state, creates/updates tickets |
| `useProjectFilter` | Filters board by selected project |
| `useTodayFocus` | Toggles view to show only today's tasks |
| `useLastSelectedProject` | Remembers last selected project for new tickets |
| `useProjectFilterKeyboard` | Keyboard shortcuts for project filtering |

### Keyboard Shortcuts

- `Cmd+Enter`: Submit forms
- `Escape`: Close dialogs
- Project number keys: Quick project filter

---

## Insights Feature (Dialog)

### Overview

Analytics dashboard showing task completion metrics:
- Date picker for historical data
- Task completion stats
- Project breakdown charts
- Framer Motion animations

### Components

| Component | Purpose |
| --------- | ------- |
| `InsightsDialog` | Main dialog container |
| `InsightsDatePicker` | Date selection UI |
| `InsightsTaskList` | Completed tasks for selected date |
| `InsightsProjectBreakdown` | Per-project statistics |
| `InsightsCharts` | Recharts visualizations |

### Data Processing

```typescript
// lib/insights-utils.ts
getTasksCompletedOnDate(board, date) → Ticket[]
calculateProjectStats(tickets) → ProjectStats[]
aggregateTimeTracking(tickets) → DurationStats
```

---

## Projects Feature

### Overview

Color-coded project categorization:
- 8 predefined colors
- CRUD operations via `useProjects` hook
- localStorage persistence
- Project filtering on board

### Available Colors

```typescript
const PROJECT_COLORS = [
  "red", "orange", "yellow", "green",
  "blue", "purple", "pink", "gray"
];
```

### Hook: useProjects

```typescript
const { projects, addProject, updateProject, deleteProject } = useProjects();
```

---

## Timer Feature

### Overview

Stopwatch for time tracking on tasks:
- Start/stop/reset controls
- Elapsed time display
- Persisted to localStorage
- Associates time with active ticket

### Store: useStopWatchStore

```typescript
interface StopWatchStore {
  isRunning: boolean;
  startTime: number | null;
  ticketId: string | null;
  start: (ticketId: string) => void;
  stop: () => void;
  reset: () => void;
}
```

### Hook: useTimerElapsedTime

```typescript
// Returns formatted elapsed time, updates every second when running
const elapsedTime = useTimerElapsedTime(); // "00:05:32"
```

---

## Task Board Core

### Overview

Shared logic used across task-related features:
- Board state management
- Drag-and-drop handlers
- Form state coordination
- Type definitions

### Key Hooks

| Hook | Purpose |
| ---- | ------- |
| `useBoardState` | Board CRUD operations, persistence |
| `useBoardDnd` | DnD sensors, handlers, active item tracking |
| `useBoardForm` | Form state coordination across components |

### Board Types

```typescript
interface Board {
  columns: Column[];
  version: number;
}

interface Column {
  id: ColumnId;
  title: string;
  tickets: Ticket[];
}

interface Ticket {
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  subTasks: SubTask[];
  createdAt: string;
  completedAt?: string;
  timeTracked?: number;
}
```

---

## Debugging Patterns

### Board State Issues

```typescript
// Check localStorage state
const rawBoard = localStorage.getItem(STORAGE_KEYS.TASKS.BOARD_STATE);
console.log(JSON.parse(rawBoard));

// Validate board structure
import { safelyDeserializeBoard } from "@/app/(protected)/dashboard/tasks/_utils/serialization";
const board = safelyDeserializeBoard(rawBoard);
```

### DnD Issues

```typescript
// Log drag events
useBoardDnd(board, setBoard, {
  onDragStart: (event) => console.log("drag start", event),
  onDragEnd: (event) => console.log("drag end", event),
});
```

### Timer Issues

```typescript
// Check timer state
const timerState = useStopWatchStore.getState();
console.log({ isRunning: timerState.isRunning, ticketId: timerState.ticketId });
```
