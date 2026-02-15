---
paths:
  - "apps/greyboard/**/*.tsx"
  - "packages/**/*.tsx"
---

# React Component Rules

## Component Size

Components should be under ~100 lines. Extract when:
- Component exceeds 100 lines
- 3+ useMemo/useCallback for business logic
- Logic is reusable across components
- Logic needs unit testing

## Component Structure

```tsx
// 1. Imports (type imports inline)
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 2. Types (if component-specific)
interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

// 3. Component
export function Card({ title, children, className }: CardProps) {
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

## Styling with cn()

Always use `cn()` for conditional classes:

```tsx
import { cn } from "@/lib/utils";

<Button
  data-slot="submit-button"
  className={cn(
    "base-styles",
    isActive && "active-styles",
    className
  )}
/>
```

## Data Attributes

Use `data-slot` for component identification:

```tsx
<Button data-slot="submit-button" />
<input data-slot="search-input" />
```

## shadcn/ui Components

Import from `@/components/ui/*`:

```tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
```

## Icons

Use Lucide React as primary icon library:

```tsx
import { Check, X, Loader2 } from "lucide-react";

// For custom icons
import { CustomIcon } from "@feel-good/icons";
```

## Anti-Patterns

### Never use setTimeout for rendering timing
- If content appears at the wrong time, the root cause is a missing Suspense boundary, wrong view-transition scope, or architectural issue
- Fix the synchronization mechanism (Suspense, view-transition-name isolation, startTransition) rather than racing a timer

### Lazy loading inside ViewTransition
- `next/dynamic` chunk resolution triggers a React transition — any ancestor `<ViewTransition>` will re-animate
- Give lazy-loaded content its own `view-transition-name` to isolate it from parent transition groups
- Suppress animation on the isolated group so content swaps are silent

## Event Handlers

Type handlers explicitly:

```tsx
const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
  // ...
};

const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "Enter") {
    // ...
  }
};
```
