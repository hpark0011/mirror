---
name: Page Composition Pattern
category: Architecture
applies_to: [pages, views, providers]
updated: 2026-01-14
documented_in: CLAUDE.md
replaces: [page-view-providers-pattern.md, server-client-separation-pattern.md]
---

# Page Composition Pattern

This document defines the standard architecture patterns for organizing Next.js pages in the Greyboard codebase. It covers both simple (2-layer) and provider-based (3-layer) page structures.

## Overview

Pages follow one of **two architectural patterns** depending on whether React Context providers are needed:

1. **Two-Layer Pattern** (Simple) - page.tsx → view.tsx
2. **Three-Layer Pattern** (With Providers) - page.tsx → providers.tsx → view.tsx

Both patterns ensure clean separation between server-side orchestration, provider setup, and client-side logic.

---

## Pattern 1: Two-Layer (Simple)

Use this pattern when **no React Context providers** are needed.

### Architecture

```
page.tsx (Server Component)
  ↓ passes data via props
{feature}-view.tsx (Client Component)
```

### When to Use

✅ Use two-layer pattern when:
- No React Context providers needed
- Simple data flow (props only)
- No shared state across components
- Straightforward page structure

### File Structure

```
app/(protected)/dashboard/{feature}/
  page.tsx                    # Server component (data fetching)
  _view/
    {feature}-view.tsx        # Client component (UI composition)
  _components/
    {feature}-*.tsx           # UI components
```

### Layer Responsibilities

#### page.tsx (Server Component)

**Responsibilities:**
- Fetch data using loaders or direct calls
- Handle server-side logic
- Pass data as props to view
- Minimal orchestration only

**Characteristics:**
- Server Component (no `"use client"`)
- Async function (can use `await`)
- No client-side hooks or state
- No UI rendering (delegates to view)

**Example:**
```typescript
import { FeatureView } from "./_view/feature-view";
import { loadFeatureData } from "./_lib/server/feature.loader";

export default async function FeaturePage() {
  // Server-side data fetching
  const data = await loadFeatureData();

  // Minimal orchestration - pass to view
  return <FeatureView data={data} />;
}
```

#### {feature}-view.tsx (Client Component)

**Responsibilities:**
- All UI composition
- All client-side logic and side effects
- Component imports and layout
- Event handlers and state management

**Characteristics:**
- Client Component (`"use client"`)
- Uses React hooks (useState, useEffect, etc.)
- Receives all data via props
- Composes child components

**Example:**
```typescript
"use client";

import { useState, useEffect } from "react";
import { FeatureHeader } from "../_components/feature-header";
import { FeatureList } from "../_components/feature-list";

interface FeatureViewProps {
  data: FeatureData;
}

export function FeatureView({ data }: FeatureViewProps) {
  const [items, setItems] = useState(data);

  // Analytics tracking
  useEffect(() => {
    trackPageView("feature");
  }, []);

  // Client-side logic
  const handleUpdate = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, updated: true } : item
    ));
  };

  return (
    <>
      <FeatureHeader title="Feature" />
      <FeatureList items={items} onUpdate={handleUpdate} />
    </>
  );
}
```

### Example: Tasks Module

**Current Implementation:**
```
app/(protected)/dashboard/tasks/
  page.tsx                    # Server component
  _view/
    tasks-view.tsx            # Client component
  _components/
    tasks-header.tsx
```

**page.tsx:**
```typescript
export default function TasksPage() {
  // Minimal - just renders view
  return <TasksView />;
}
```

**tasks-view.tsx:**
```typescript
"use client";

export function TasksView() {
  // All client-side logic here
  return (
    <>
      <TasksHeader />
      <Board />
    </>
  );
}
```

---

## Pattern 2: Three-Layer (With Providers)

Use this pattern when **React Context providers are needed**.

### Architecture

```
page.tsx (Server Component)
  ↓ passes data via props
{feature}-providers.tsx (Client Wrapper - providers only)
  ↓ wraps children
{feature}-view.tsx (Client Component - all logic)
```

### When to Use

✅ Use three-layer pattern when:
- React Context providers needed
- Multiple nested providers
- Global state for feature (Zustand, Context API)
- UI elements requiring providers (modals, dialogs)

### File Structure

```
app/(protected)/dashboard/{feature}/
  page.tsx                           # Server component
  _view/
    {feature}-view.tsx               # Client component (logic)
  _components/
    {feature}-providers.tsx          # Client wrapper (providers only)
    {feature}-*.tsx                  # UI components
```

### Layer Responsibilities

#### page.tsx (Server Component)

**Same as two-layer pattern:**
- Fetch data server-side
- Pass data as props
- Wrap view with providers

**Example:**
```typescript
import { FeatureProviders } from "./_components/feature-providers";
import { FeatureView } from "./_view/feature-view";
import { loadFeatureData } from "./_lib/server/feature.loader";

export default async function FeaturePage() {
  const data = await loadFeatureData();

  return (
    <FeatureProviders>
      <FeatureView data={data} />
    </FeatureProviders>
  );
}
```

#### {feature}-providers.tsx (Client Provider Wrapper)

**Responsibilities:**
- Wrap children with React Context providers
- Include UI elements requiring providers (modals)
- **NO business logic or side effects**
- **NO data fetching or state management**

**Characteristics:**
- Client Component (`"use client"`)
- Minimal wrapper - providers only
- May use hooks to access context (e.g., `useContext`)
- No `useEffect`, `useState`, or side effects
- No data fetching

**Example:**
```typescript
"use client";

import { FeatureProvider } from "@/lib/state/feature-context";
import { DialogProvider } from "@/components/ui/dialog";
import { FeatureModal } from "./feature-modal";

interface FeatureProvidersProps {
  children: React.ReactNode;
}

export function FeatureProviders({ children }: FeatureProvidersProps) {
  return (
    <FeatureProvider>
      <DialogProvider>
        {children}
        <FeatureModal />
      </DialogProvider>
    </FeatureProvider>
  );
}
```

**What NOT to include:**
- ❌ Side effects (`useEffect` for analytics, navigation)
- ❌ Data fetching (`useQuery`, `useTRPC`, server actions)
- ❌ State management (`useState`, `useReducer`)
- ❌ Business logic (auto-complete, transition tracking)

#### {feature}-view.tsx (Client View Component)

**Responsibilities:**
- All client-side logic and side effects
- Component composition
- Analytics tracking
- Navigation handlers
- Business logic

**Characteristics:**
- Client Component (`"use client"`)
- Contains all `useEffect` hooks
- Manages UI state
- Receives data via props

**Example:**
```typescript
"use client";

import { useEffect } from "react";
import { useFeatureContext } from "@/lib/state/feature-context";

interface FeatureViewProps {
  data: FeatureData;
}

export function FeatureView({ data }: FeatureViewProps) {
  const { setData } = useFeatureContext();

  // Initialize context with server data
  useEffect(() => {
    setData(data);
  }, [data, setData]);

  // Analytics tracking
  useEffect(() => {
    trackPageView("feature");
  }, []);

  // Navigation handlers
  useEffect(() => {
    const handlePopstate = () => {
      // Navigation logic
    };
    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, []);

  return (
    <>
      <FeatureHeader />
      <FeatureContent />
    </>
  );
}
```

**What to include:**
- ✅ All `useEffect` hooks
- ✅ Analytics tracking
- ✅ Navigation event handlers
- ✅ Business logic
- ✅ Component composition
- ✅ Client-side data fetching (if needed)

---

## Choosing the Right Pattern

### Decision Tree

```
Do you need React Context providers?
│
├─ NO  → Use Two-Layer Pattern
│         (page.tsx → view.tsx)
│
└─ YES → Use Three-Layer Pattern
          (page.tsx → providers.tsx → view.tsx)
          │
          └─ Do you have side effects/logic?
              │
              ├─ YES → Put in view.tsx (NOT providers)
              └─ NO  → Providers only wrap children
```

### Examples

| Feature | Pattern | Reason |
|---------|---------|--------|
| Tasks | Two-Layer | No providers needed |
| Files (planned) | Two-Layer | Simple data flow |
| Dashboard | Three-Layer | Multiple context providers |
| Profile | Three-Layer | Theme provider, auth context |

---

## Data Flow

### Two-Layer Flow

```
┌─────────────────────────────────────────────────────────┐
│ page.tsx (Server Component)                             │
│ - async function                                        │
│ - await loadData()                                      │
└────────────────┬────────────────────────────────────────┘
                 │ <FeatureView data={data} />
                 ↓
┌─────────────────────────────────────────────────────────┐
│ feature-view.tsx (Client Component)                     │
│ - Receives data via props                               │
│ - All client-side logic                                 │
│ - Component composition                                 │
└─────────────────────────────────────────────────────────┘
```

### Three-Layer Flow

```
┌─────────────────────────────────────────────────────────┐
│ page.tsx (Server Component)                             │
│ - async function                                        │
│ - await loadData()                                      │
└────────────────┬────────────────────────────────────────┘
                 │ <Providers><View data={data} /></Providers>
                 ↓
┌─────────────────────────────────────────────────────────┐
│ feature-providers.tsx (Client Wrapper)                  │
│ - Context providers ONLY                                │
│ - No logic, no side effects                             │
└────────────────┬────────────────────────────────────────┘
                 │ {children}
                 ↓
┌─────────────────────────────────────────────────────────┐
│ feature-view.tsx (Client Component)                     │
│ - Receives data via props                               │
│ - All client-side logic and side effects                │
│ - Component composition                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Key Principles

### 1. Separation of Concerns

- **Server (page.tsx)**: Data fetching only
- **Providers**: Context providers only (if needed)
- **View**: All client-side logic

### 2. Data Flow Direction

- Data flows **down** from page.tsx → view.tsx via props
- Never fetch data in providers wrapper
- View can fetch additional client-side data if needed

### 3. Side Effects Location

- **Analytics tracking**: view.tsx
- **Navigation handlers**: view.tsx
- **Auto-complete logic**: view.tsx
- **NOT in providers wrapper**

### 4. Provider Wrapper Minimalism

- Providers wrapper should be **as thin as possible**
- Only include providers required for the entire feature
- If a provider is only needed by one component, move it closer

---

## Anti-Patterns

### ❌ DON'T: Put Side Effects in Providers Wrapper

```typescript
// WRONG
export function FeatureProviders({ children }: Props) {
  useEffect(() => {
    trackPageView(); // BAD - side effect in providers
  }, []);

  return <Provider>{children}</Provider>;
}
```

✅ **DO: Put Side Effects in View**
```typescript
// CORRECT
export function FeatureView() {
  useEffect(() => {
    trackPageView(); // GOOD - side effect in view
  }, []);

  return <div>...</div>;
}
```

### ❌ DON'T: Fetch Data in Providers Wrapper

```typescript
// WRONG
export function FeatureProviders({ children }: Props) {
  const { data } = useTRPC.query.getData(); // BAD!
  return <Provider value={data}>{children}</Provider>;
}
```

✅ **DO: Fetch Data in page.tsx or View**
```typescript
// CORRECT - in page.tsx
export default async function Page() {
  const data = await loadData(); // GOOD
  return <FeatureProviders><FeatureView data={data} /></FeatureProviders>;
}
```

### ❌ DON'T: Create Unnecessary Pass-Through Components

```typescript
// WRONG - unnecessary wrapper
export function FeatureContent(props: Props) {
  return <FeatureView {...props} />;
}
```

✅ **DO: Use View Directly from page.tsx**
```typescript
// CORRECT
export default async function Page() {
  return <FeatureProviders><FeatureView {...props} /></FeatureProviders>;
}
```

### ❌ DON'T: Mix Data Fetching and UI in page.tsx

```typescript
// WRONG
"use client";
export default function Page() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchData().then(setData);
  }, []);
  return <div>{/* UI */}</div>;
}
```

✅ **DO: Separate Data Fetching and UI**
```typescript
// CORRECT - page.tsx
export default async function Page() {
  const data = await fetchData();
  return <PageView data={data} />;
}

// page-view.tsx
"use client";
export function PageView({ data }) {
  return <div>{/* UI */}</div>;
}
```

---

## Checklist for New Pages

### Two-Layer Pattern:
- [ ] `page.tsx` is Server Component (no `"use client"`)
- [ ] `page.tsx` fetches data server-side (async/await)
- [ ] `{feature}-view.tsx` is Client Component (`"use client"`)
- [ ] All data passed as props from page to view
- [ ] All UI structure in view, not page
- [ ] All client-side hooks in view, not page
- [ ] No providers needed

### Three-Layer Pattern:
- [ ] `page.tsx` is Server Component
- [ ] `page.tsx` fetches data and wraps with providers
- [ ] `{feature}-providers.tsx` contains **only** providers
- [ ] `{feature}-providers.tsx` has **no** side effects
- [ ] `{feature}-providers.tsx` has **no** data fetching
- [ ] `{feature}-view.tsx` contains all client-side logic
- [ ] `{feature}-view.tsx` receives data via props
- [ ] Side effects are in view, not providers
- [ ] No unnecessary pass-through components

---

## Related Patterns

- **composition.md** - How to organize components within a feature
- **state-management.md** - When to use different state approaches

---

## Summary

**Key Takeaways:**

1. ✅ **Two patterns:** Simple (2-layer) and Provider-based (3-layer)
2. ✅ **Choose based on providers:** No providers = 2-layer, Providers needed = 3-layer
3. ✅ **page.tsx:** Server component, data fetching only
4. ✅ **providers.tsx:** Thin wrapper, providers only, NO logic
5. ✅ **view.tsx:** All client-side logic, side effects, composition
6. ✅ **Data flows down:** page → [providers →] view via props
7. ✅ **Side effects go in view:** NOT in providers wrapper
8. ✅ **Keep it simple:** Don't add layers you don't need

This pattern ensures:
- Clean separation between server and client concerns
- Consistent page structure across features
- Easy discovery of data fetching and business logic
- Minimal provider overhead
- Clear responsibilities for each layer
