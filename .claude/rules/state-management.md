---
paths:
  - "apps/greyboard/**/*.ts"
  - "apps/greyboard/**/*.tsx"
---

# State Management Rules

## Decision Tree

| Need                          | Solution                    |
| ----------------------------- | --------------------------- |
| Component-local state         | useState/useReducer         |
| Cross-component, persisted    | localStorage (useLocalStorage) |
| Global, complex, non-persisted| Zustand                     |
| Theme, auth context           | React Context               |
| Server data                   | Supabase + React Query      |

## localStorage (Primary for Tasks)

Use `useLocalStorage` hook for SSR-safe, cross-tab synchronized storage:

```typescript
import { useLocalStorage } from "@/hooks/use-local-storage";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const [board, setBoard] = useLocalStorage<Board>(
  STORAGE_KEYS.TASKS.BOARD_STATE,
  defaultBoard
);
```

### Key Naming

All keys defined in `lib/storage-keys.ts`:

```typescript
const STORAGE_KEYS = {
  TASKS: {
    BOARD_STATE: "docgen.v1.tasks.board-state",
    PROJECTS: "docgen.v1.tasks.projects",
    PROJECT_FILTER: "docgen.v1.tasks.project-filter",
  },
  UI: {
    TODAY_FOCUS: "docgen.v1.ui.today-focus",
    THEME: "theme",
  },
};
```

## Zustand

For complex global state without persistence needs:

```typescript
import { create } from "zustand";

interface StopWatchStore {
  isRunning: boolean;
  startTime: number | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export const useStopWatchStore = create<StopWatchStore>((set) => ({
  isRunning: false,
  startTime: null,
  start: () => set({ isRunning: true, startTime: Date.now() }),
  stop: () => set({ isRunning: false }),
  reset: () => set({ isRunning: false, startTime: null }),
}));
```

### Store Location

- Feature stores: `features/{feature}/store.ts`
- Shared stores: `store/{name}-store.ts`

## React Context

For theme, auth, and dependency injection:

```typescript
// providers/theme-provider.tsx
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
```

## Hook Callback Refs

Store callbacks in refs to avoid re-running effects:

```typescript
const callbackRef = useRef(onSubmit);
useEffect(() => {
  callbackRef.current = onSubmit;
}, [onSubmit]);

useEffect(() => {
  // Use callbackRef.current instead of onSubmit
}, [enabled]); // Don't include onSubmit in deps
```
