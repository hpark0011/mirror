---
title: "feat: App Dock Navigation UI Components"
type: feat
date: 2026-02-04
app: greyboard
package: "@feel-good/features"
---

# App Dock Navigation UI Components

## Overview

Build a macOS-style app dock UI component for navigating between Greyboard's internal apps (Doc Viewer, Threads, Task Board, Agent Book). The dock slides in from the bottom when the cursor enters an activation zone and provides visual feedback through tooltips and click animations.

This phase focuses exclusively on **UI component architecture and styling**. No routing, state persistence, or business logic implementation.

## Problem Statement / Motivation

Greyboard is an agent orchestration application with multiple internal "apps". Users need an intuitive, visually appealing way to switch between these apps. A macOS-style dock provides:

- Familiar UX pattern for desktop users
- Minimal screen real estate usage (auto-hide)
- Clear visual hierarchy with icons and tooltips
- Satisfying micro-interactions (scale on click, smooth slide animations)

## Proposed Solution

Create a dock feature package at `packages/features/dock/` following the established four-layer architecture pattern from the auth feature:

```
packages/features/dock/
├── components/           # Primitive components
│   ├── dock-root.tsx    # Container with activation zone logic
│   ├── dock-container.tsx # Visible dock bar
│   ├── dock-item.tsx    # Individual app icon wrapper
│   ├── dock-icon.tsx    # Icon with superellipse styling
│   ├── dock-tooltip.tsx # Tooltip wrapper for app names
│   └── index.ts
├── blocks/              # Composed components
│   ├── app-dock.tsx     # Full dock assembly
│   └── index.ts
├── providers/           # Context providers
│   ├── dock-provider.tsx # Dock state context
│   └── index.ts
├── hooks/               # Headless logic
│   ├── use-dock-visibility.ts # Show/hide logic
│   ├── use-dock-config.ts     # Config access
│   └── index.ts
├── lib/                 # Utilities and types
│   ├── dock-config.ts   # Configuration schema
│   └── types.ts
└── index.ts
```

## Technical Considerations

### Architecture

**Composition Pattern (shadcn/ui style)**

Components are designed for maximum flexibility through composition:

```tsx
// Full assembly via block
<AppDock config={dockConfig} />

// Or compose primitives for customization
<DockRoot>
  <DockContainer>
    <DockItem>
      <DockIcon icon={DocViewerIcon} />
      <DockTooltip>Doc Viewer</DockTooltip>
    </DockItem>
  </DockContainer>
</DockRoot>
```

**Provider Architecture**

Following the established separation of concerns pattern:

```
DockProvider (providers/dock-provider.tsx)
    |
    +-- Context: visibility state, config, active app
    +-- Consumed by: DockRoot, DockContainer, DockItem
```

### CSS Features

**Superellipse Corner Shape**

```css
/* Modern browsers */
corner-shape: superellipse(1.2);
border-radius: var(--dock-icon-radius);

/* Fallback */
@supports not (corner-shape: superellipse(1.2)) {
  border-radius: 0.75rem; /* rounded-xl */
}
```

**Positioning**

```css
.dock-container {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
}

.activation-zone {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  pointer-events: auto;
}
```

### Animation Approach

Use Tailwind CSS transitions for simplicity (no Framer Motion needed):

```tsx
// Slide animation
className={cn(
  "transition-transform duration-200 ease-out",
  isVisible ? "translate-y-0" : "translate-y-full"
)}

// Click feedback
className="active:scale-97 transition-transform duration-100"

// Tooltip
className={cn(
  "transition-opacity duration-150",
  isHovered ? "opacity-100" : "opacity-0"
)}
```

### Accessibility Considerations

- `role="navigation"` on dock container
- `aria-label` on dock for screen readers
- `role="button"` and `aria-pressed` on dock items
- Keyboard navigation (Tab through items, Enter to activate)
- `prefers-reduced-motion` media query support

## Acceptance Criteria

### Component Structure

- [ ] Create `packages/features/dock/` directory structure
- [ ] Export all components via barrel files (`index.ts`)
- [ ] Update `packages/features/package.json` exports

### Primitive Components (`components/`)

- [ ] `DockRoot` - Wraps entire dock system including activation zone
- [ ] `DockContainer` - Visible dock bar with backdrop blur and styling
- [ ] `DockItem` - Wrapper for each app (handles click, hover states)
- [ ] `DockIcon` - Icon component with superellipse corners
- [ ] `DockTooltip` - Tooltip showing app name on hover
- [ ] All components use `data-slot` attributes
- [ ] All components accept `className` prop for customization

### Block Components (`blocks/`)

- [ ] `AppDock` - Composed component that renders full dock from config

### Provider (`providers/`)

- [ ] `DockProvider` - Context for dock visibility and config
- [ ] `useDock` hook for consuming context

### Hooks (`hooks/`)

- [ ] `useDockVisibility` - Manages show/hide state
- [ ] `useDockConfig` - Access dock configuration

### Types (`lib/`)

- [ ] `DockConfig` interface
- [ ] `DockApp` interface
- [ ] `DockPlacement` type

### Styling Requirements

- [ ] `active:scale-97` on icon click
- [ ] `corner-shape: superellipse(1.2)` with `rounded-xl` fallback
- [ ] Tooltip appears on hover with app name
- [ ] Dock slides in/out from bottom with smooth animation
- [ ] Dock positioned 8px above bottom of window
- [ ] Activation zone: 72px height, full width, bottom of window

### Code Quality

- [ ] Clear separation of UI, logic, and state
- [ ] Single responsibility per component
- [ ] Explicit, unambiguous naming
- [ ] No business logic (routing, persistence) in components

## Configuration Schema

```typescript
// lib/types.ts

export type DockPlacement = 'bottom'; // Extensible for future: 'left' | 'right' | 'top'

export interface DockApp {
  /** Unique identifier */
  id: string;
  /** Display name shown in tooltip */
  name: string;
  /** Icon component to render */
  icon: React.ComponentType<{ className?: string }>;
  /** Navigation route */
  route: string;
  /** Sort order (lower = left) */
  order: number;
}

export interface DockConfig {
  /** Dock position - currently only 'bottom' supported */
  placement: DockPlacement;
  /** Array of apps to display */
  apps: DockApp[];
  /** ID of default app (loads on initial render) */
  defaultAppId: string;
}

export interface DockState {
  /** Whether dock is currently visible */
  isVisible: boolean;
  /** Currently active app ID */
  activeAppId: string | null;
}
```

## Implementation Details

### File: `components/dock-root.tsx`

```tsx
"use client";

import { cn } from "@feel-good/utils/cn";

interface DockRootProps {
  children: React.ReactNode;
  className?: string;
}

export function DockRoot({ children, className }: DockRootProps) {
  return (
    <div
      data-slot="dock-root"
      className={cn("fixed inset-x-0 bottom-0 z-50", className)}
    >
      {/* Activation zone */}
      <div
        data-slot="dock-activation-zone"
        className="absolute inset-x-0 bottom-0 h-[72px]"
      />
      {children}
    </div>
  );
}
```

### File: `components/dock-container.tsx`

```tsx
"use client";

import { cn } from "@feel-good/utils/cn";

interface DockContainerProps {
  children: React.ReactNode;
  isVisible?: boolean;
  className?: string;
}

export function DockContainer({
  children,
  isVisible = true,
  className,
}: DockContainerProps) {
  return (
    <nav
      role="navigation"
      aria-label="App navigation"
      data-slot="dock-container"
      data-state={isVisible ? "visible" : "hidden"}
      className={cn(
        // Position
        "fixed bottom-2 left-1/2 -translate-x-1/2",
        // Layout
        "flex items-center gap-2 px-3 py-2",
        // Appearance
        "bg-background/80 backdrop-blur-lg",
        "border border-border/50 rounded-2xl shadow-lg",
        // Animation
        "transition-transform duration-200 ease-out",
        isVisible ? "translate-y-0" : "translate-y-[calc(100%+16px)]",
        className
      )}
    >
      {children}
    </nav>
  );
}
```

### File: `components/dock-icon.tsx`

```tsx
"use client";

import { cn } from "@feel-good/utils/cn";

interface DockIconProps {
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  className?: string;
}

export function DockIcon({ icon: Icon, isActive, className }: DockIconProps) {
  return (
    <div
      data-slot="dock-icon"
      data-active={isActive}
      className={cn(
        // Size
        "size-12 p-2",
        // Shape - superellipse with fallback
        "[corner-shape:superellipse(1.2)] rounded-xl",
        // Appearance
        "bg-muted/50",
        "flex items-center justify-center",
        // States
        "transition-all duration-100",
        "hover:bg-muted",
        "active:scale-97",
        isActive && "bg-primary/10 ring-2 ring-primary/20",
        className
      )}
    >
      <Icon className="size-7" />
    </div>
  );
}
```

### File: `components/dock-item.tsx`

```tsx
"use client";

import { cn } from "@feel-good/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";

interface DockItemProps {
  children: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function DockItem({
  children,
  label,
  isActive,
  onClick,
  className,
}: DockItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="button"
          aria-pressed={isActive}
          aria-label={label}
          data-slot="dock-item"
          onClick={onClick}
          className={cn(
            "relative cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          {children}
          {/* Active indicator dot */}
          {isActive && (
            <span
              data-slot="dock-item-indicator"
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
```

### File: `providers/dock-provider.tsx`

```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type { DockConfig, DockState } from "../lib/types";

interface DockContextValue {
  config: DockConfig;
  state: DockState;
  setVisible: (visible: boolean) => void;
  setActiveApp: (appId: string) => void;
}

const DockContext = createContext<DockContextValue | null>(null);

interface DockProviderProps {
  children: ReactNode;
  config: DockConfig;
  initialActiveAppId?: string;
}

export function DockProvider({
  children,
  config,
  initialActiveAppId,
}: DockProviderProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeAppId, setActiveAppId] = useState<string | null>(
    initialActiveAppId ?? config.defaultAppId
  );

  const value = useMemo<DockContextValue>(
    () => ({
      config,
      state: { isVisible, activeAppId },
      setVisible: setIsVisible,
      setActiveApp: setActiveAppId,
    }),
    [config, isVisible, activeAppId]
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useDock(): DockContextValue {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error("useDock must be used within DockProvider");
  }
  return context;
}
```

### File: `hooks/use-dock-visibility.ts`

```tsx
"use client";

import { useCallback, useRef } from "react";
import { useDock } from "../providers/dock-provider";

interface UseDockVisibilityOptions {
  /** Delay before hiding dock after cursor leaves (ms) */
  hideDelay?: number;
}

export function useDockVisibility(options: UseDockVisibilityOptions = {}) {
  const { hideDelay = 300 } = options;
  const { state, setVisible } = useDock();
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setVisible(true);
  }, [setVisible]);

  const hide = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, hideDelay);
  }, [setVisible, hideDelay]);

  const handleActivationZoneEnter = useCallback(() => {
    show();
  }, [show]);

  const handleDockLeave = useCallback(() => {
    hide();
  }, [hide]);

  return {
    isVisible: state.isVisible,
    show,
    hide,
    handlers: {
      onActivationZoneEnter: handleActivationZoneEnter,
      onDockLeave: handleDockLeave,
    },
  };
}
```

### File: `blocks/app-dock.tsx`

```tsx
"use client";

import { cn } from "@feel-good/utils/cn";
import { DockRoot } from "../components/dock-root";
import { DockContainer } from "../components/dock-container";
import { DockItem } from "../components/dock-item";
import { DockIcon } from "../components/dock-icon";
import { DockProvider, useDock } from "../providers/dock-provider";
import { useDockVisibility } from "../hooks/use-dock-visibility";
import type { DockConfig } from "../lib/types";

interface AppDockProps {
  config: DockConfig;
  onAppClick?: (appId: string) => void;
  className?: string;
}

function AppDockContent({ onAppClick, className }: Omit<AppDockProps, "config">) {
  const { config, state, setActiveApp } = useDock();
  const { isVisible, handlers } = useDockVisibility();

  const sortedApps = [...config.apps].sort((a, b) => a.order - b.order);

  const handleAppClick = (appId: string) => {
    setActiveApp(appId);
    onAppClick?.(appId);
  };

  return (
    <DockRoot>
      {/* Activation zone */}
      <div
        className="absolute inset-x-0 bottom-0 h-[72px]"
        onMouseEnter={handlers.onActivationZoneEnter}
      />
      {/* Dock */}
      <DockContainer
        isVisible={isVisible}
        className={className}
        onMouseLeave={handlers.onDockLeave}
      >
        {sortedApps.map((app) => (
          <DockItem
            key={app.id}
            label={app.name}
            isActive={state.activeAppId === app.id}
            onClick={() => handleAppClick(app.id)}
          >
            <DockIcon
              icon={app.icon}
              isActive={state.activeAppId === app.id}
            />
          </DockItem>
        ))}
      </DockContainer>
    </DockRoot>
  );
}

export function AppDock({ config, ...props }: AppDockProps) {
  return (
    <DockProvider config={config}>
      <AppDockContent {...props} />
    </DockProvider>
  );
}
```

## Package Exports

Add to `packages/features/package.json`:

```json
{
  "exports": {
    "./dock": "./dock/index.ts",
    "./dock/blocks": "./dock/blocks/index.ts",
    "./dock/components": "./dock/components/index.ts",
    "./dock/hooks": "./dock/hooks/index.ts",
    "./dock/providers": "./dock/providers/index.ts",
    "./dock/lib/types": "./dock/lib/types.ts"
  }
}
```

## Usage Example

```tsx
import { AppDock } from "@feel-good/features/dock/blocks";
import { DocViewerIcon, ThreadsIcon, TaskBoardIcon, AgentBookIcon } from "@feel-good/icons";

const dockConfig = {
  placement: "bottom" as const,
  defaultAppId: "doc-viewer",
  apps: [
    { id: "doc-viewer", name: "Doc Viewer", icon: DocViewerIcon, route: "/docs", order: 0 },
    { id: "threads", name: "Threads", icon: ThreadsIcon, route: "/threads", order: 1 },
    { id: "task-board", name: "Task Board", icon: TaskBoardIcon, route: "/tasks", order: 2 },
    { id: "agent-book", name: "Agent Book", icon: AgentBookIcon, route: "/agents", order: 3 },
  ],
};

export function Layout({ children }) {
  const router = useRouter();

  return (
    <>
      {children}
      <AppDock
        config={dockConfig}
        onAppClick={(appId) => {
          const app = dockConfig.apps.find(a => a.id === appId);
          if (app) router.push(app.route);
        }}
      />
    </>
  );
}
```

## Success Metrics

- All components render correctly in Storybook/ui-factory
- Click feedback (scale-97) feels responsive
- Tooltip appears on hover with correct positioning
- Slide animation is smooth and natural
- Activation zone reliably triggers dock visibility
- Active app indicator correctly reflects state

## Dependencies & Risks

**Dependencies:**
- `@feel-good/ui` - Tooltip primitive
- `@feel-good/utils` - cn utility
- `@feel-good/icons` - App icons (may need to create new icons)

**Risks:**
- `corner-shape: superellipse()` has limited browser support (Chrome 131+)
- Activation zone may interfere with scrollable content at bottom of page

## Non-Goals (Explicit)

- **No routing implementation** - Components emit click events; app handles navigation
- **No state persistence** - No localStorage or cookies for dock state
- **No keyboard shortcuts** - Can be added in future iteration
- **No mobile/touch support** - Desktop-first, touch handled separately
- **No Framer Motion** - Use Tailwind transitions for simplicity

## References & Research

### Internal References

- Auth feature structure: `packages/features/auth/`
- Sidebar provider pattern: `packages/ui/src/primitives/sidebar.tsx`
- Tooltip implementation: `packages/ui/src/primitives/tooltip.tsx`
- Button with active:scale: `packages/ui/src/primitives/button.tsx:42`

### Codebase Learnings

- Provider separation: `docs/solutions/architecture-patterns/provider-separation-of-concerns.md`
- Tailwind monorepo config: `docs/solutions/tailwind/monorepo-source-configuration.md`

### External References

- CSS corner-shape: [Chrome 131 release notes](https://developer.chrome.com/blog/css-shape-functions)
- macOS Dock UX: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/the-dock)
