---
paths:
  - "apps/greyboard/hooks/**/*"
  - "apps/greyboard/features/**/hooks/**/*"
  - "apps/greyboard/app/**/_hooks/**/*"
---

# Hook Conventions

## JSDoc Requirement

All custom hooks MUST have JSDoc with:
- Purpose description
- @param for each parameter
- @returns describing return value
- @example with usage

```typescript
/**
 * Manages localStorage state with SSR safety and cross-tab synchronization.
 * @param key - Storage key from STORAGE_KEYS
 * @param initialValue - Default value if key doesn't exist
 * @returns [value, setValue, removeValue] tuple
 * @example
 * const [theme, setTheme] = useLocalStorage("theme", "light");
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  // ...
}
```

## Hook Categories

### General Hooks (`/hooks/`)

| Hook                      | Purpose                                |
| ------------------------- | -------------------------------------- |
| `use-local-storage`       | SSR-safe localStorage with cross-tab sync |
| `use-dialog-auto-save`    | Auto-save form drafts to localStorage  |
| `use-focus-management`    | Focus management for dialogs           |
| `use-keyboard-submit`     | Cmd+Enter form submission              |
| `use-debounced-callback`  | Debounce function calls                |
| `use-keyboard-navigation` | Arrow key navigation                   |
| `use-mobile`              | Mobile breakpoint detection            |

### Feature Hooks (`features/*/hooks/`)

| Feature          | Hooks                                    |
| ---------------- | ---------------------------------------- |
| `task-board-core`| `use-board-state`, `use-board-dnd`, `use-board-form` |
| `project-select` | `use-projects`, `use-project-selection`, `use-search-state` |
| `timer`          | `use-timer-elapsed-time`                 |

### Route Hooks (`app/**/_hooks/`)

| Route   | Hooks                                              |
| ------- | -------------------------------------------------- |
| `/tasks`| `use-ticket-form`, `use-project-filter`, `use-today-focus`, `use-last-selected-project` |

## Callback Ref Pattern

For callbacks in useEffect dependencies:

```typescript
const callbackRef = useRef(onSubmit);

// Keep ref current
useEffect(() => {
  callbackRef.current = onSubmit;
}, [onSubmit]);

// Use ref in effect (no onSubmit in deps)
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      callbackRef.current();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [enabled]); // Only enabled, not onSubmit
```

## Effect Cleanup

Always clean up side effects:

```typescript
useEffect(() => {
  const controller = new AbortController();

  fetchData({ signal: controller.signal });

  return () => controller.abort();
}, [dependency]);
```

## Memoization

Use useMemo/useCallback sparingly:
- useMemo: Expensive calculations, referential equality for deps
- useCallback: Callbacks passed to memoized children

```typescript
// ✅ Good - expensive calculation
const sortedTasks = useMemo(
  () => tasks.sort((a, b) => b.priority - a.priority),
  [tasks]
);

// ❌ Bad - simple derivation
const taskCount = useMemo(() => tasks.length, [tasks]);
// Just use: const taskCount = tasks.length;
```
