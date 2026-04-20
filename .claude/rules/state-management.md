---
paths:
  - "**/hooks/**/*.ts"
  - "**/hooks/**/*.tsx"
  - "**/context/**/*.tsx"
  - "**/providers/**/*.tsx"
  - "**/store/**/*.ts"
---

# State Management Rules

## Decision Tree

| Need                        | Solution                        |
| --------------------------- | ------------------------------- |
| Component-local state       | `useState` / `useReducer`       |
| Cross-component, persisted  | `useLocalStorage` hook          |
| Theme, auth, DI             | React Context                   |
| Global non-persisted        | React Context (Zustand is not used in this repo; reach out before adding it) |

## localStorage

SSR-safe, cross-tab synchronized storage via the shared hook:

```typescript
import { useLocalStorage } from "@/hooks/use-local-storage"; // apps/mirror
// or
import { useLocalStorage } from "@feel-good/utils/use-local-storage"; // packages

const [value, setValue] = useLocalStorage<string>("my-key", "default");
```

## React Context

For theme, auth, and dependency injection:

```typescript
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

## Store Location (when needed)

- Feature stores: `features/{feature}/store.ts`
- Shared stores: `store/{name}-store.ts`
