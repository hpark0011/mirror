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
