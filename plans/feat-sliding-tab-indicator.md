# feat: Sliding Tab Indicator Component

## Overview

Create a reusable tab component with an active state indicator that smoothly slides between tab items when clicked. The indicator provides visual feedback for the currently active tab using animated transitions.

## Problem Statement / Motivation

The current tabs component (`components/ui/tabs.tsx`) uses static background highlighting for the active state (`data-[state=active]:bg-[#FFEED6]`). While functional, it lacks the polished interaction feel of a sliding indicator that animates between tabs, which is a common UX pattern in modern applications.

## Proposed Solution

Implement a **Framer Motion layoutId-based** sliding tab indicator. This approach is recommended because:

1. **Framer Motion 12.23.12 is already installed** - no new dependencies
2. **Minimal code** - layoutId handles measurements and animations automatically
3. **Smooth physics-based animations** - spring transitions feel natural
4. **Handles edge cases** - variable-width tabs, resize, etc.

The implementation will create a new `SlidingTabsList` component that can be used with the existing `Tabs` root, following the shadcn/ui composable primitives pattern.

## Technical Approach

### Architecture

Create a new component file alongside the existing tabs:

```
components/ui/
  tabs.tsx                 # Existing (unchanged)
  sliding-tabs.tsx         # New sliding indicator variant
```

### Core Implementation Pattern

The Framer Motion `layoutId` prop enables shared element transitions. Only the active tab renders the indicator; when the active tab changes, Framer Motion automatically animates the indicator between positions.

```tsx
// Simplified concept
function SlidingTabsTrigger({ children, value }) {
  return (
    <TabsPrimitive.Trigger value={value}>
      {/* Indicator renders only when active, layoutId makes it "slide" */}
      <span className="absolute inset-0 hidden group-data-[state=active]:block">
        <motion.span
          layoutId="indicator"
          className="absolute inset-0 rounded-sm bg-[#FFEED6]"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      </span>
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  );
}
```

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Animation library | Framer Motion layoutId | Already installed, minimal code, automatic measurements |
| Component structure | New variant alongside existing | No breaking changes to current usage |
| Multiple instances | LayoutGroup with useId | Prevents cross-group animation conflicts |
| Reduced motion | useReducedMotion hook | Accessibility, matches existing pattern in ring-percentage.tsx |
| Initial animation | Disabled (`initial={false}`) | Prevents jarring animation on page load |

## Acceptance Criteria

### Functional Requirements

- [ ] Clicking a tab causes the indicator to slide smoothly to that tab
- [ ] Works with both controlled and uncontrolled Tabs
- [ ] Supports variable-width tabs (content-based sizing)
- [ ] Multiple SlidingTabs instances on same page work independently
- [ ] No animation on initial page render
- [ ] Respects `prefers-reduced-motion` OS setting

### Non-Functional Requirements

- [ ] Animation feels smooth and responsive (spring physics, ~300ms)
- [ ] Component follows shadcn/ui patterns (`data-slot`, `cn()`, function declarations)
- [ ] JSDoc documentation on exported components
- [ ] TypeScript types for all props
- [ ] Dark mode support

### Quality Gates

- [ ] `pnpm lint` passes
- [ ] No TypeScript errors
- [ ] Works in Chrome, Firefox, Safari
- [ ] Keyboard navigation works (Arrow keys, Tab, Enter)

## Implementation Phases

### Phase 1: Core Component

**Files to create:**
- `components/ui/sliding-tabs.tsx`

**Tasks:**
1. Create `SlidingTabsList` with LayoutGroup wrapper
2. Create `SlidingTabsTrigger` with motion indicator
3. Export alongside Tabs primitives
4. Add spring transition configuration
5. Add `useReducedMotion` support

**Deliverable:** Working sliding tabs component

### Phase 2: Styling & Polish

**Tasks:**
1. Match existing tabs styling (border, padding, colors)
2. Add dark mode indicator colors
3. Add focus-visible styling
4. Ensure indicator z-index is correct (behind text)
5. Test with various text lengths

**Deliverable:** Polished visual appearance

### Phase 3: Documentation & Integration

**Tasks:**
1. Add JSDoc to all exported components
2. Create usage example in a test page or Storybook
3. Document props and customization options
4. Consider updating auth-form.tsx to use new component (optional)

**Deliverable:** Documented, ready-to-use component

## MVP Implementation

### sliding-tabs.tsx

```tsx
"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, LayoutGroup, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const SPRING_TRANSITION = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
};

/**
 * Tabs with a sliding active indicator.
 * Use with SlidingTabsList and SlidingTabsTrigger for animated tab switching.
 *
 * @example
 * <SlidingTabs defaultValue="tab1">
 *   <SlidingTabsList>
 *     <SlidingTabsTrigger value="tab1">Account</SlidingTabsTrigger>
 *     <SlidingTabsTrigger value="tab2">Password</SlidingTabsTrigger>
 *   </SlidingTabsList>
 *   <TabsContent value="tab1">Account content</TabsContent>
 *   <TabsContent value="tab2">Password content</TabsContent>
 * </SlidingTabs>
 */
function SlidingTabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="sliding-tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

/**
 * Container for SlidingTabsTrigger components.
 * Wraps children in LayoutGroup for independent animation scoping.
 */
function SlidingTabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const layoutGroupId = React.useId();

  return (
    <LayoutGroup id={layoutGroupId}>
      <TabsPrimitive.List
        data-slot="sliding-tabs-list"
        className={cn(
          "relative inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </LayoutGroup>
  );
}

/**
 * Tab trigger with sliding indicator animation.
 * The indicator smoothly transitions between active tabs.
 */
function SlidingTabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <TabsPrimitive.Trigger
      data-slot="sliding-tabs-trigger"
      className={cn(
        "group relative z-10 inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors",
        "text-muted-foreground",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:text-foreground",
        className
      )}
      {...props}
    >
      {/* Sliding indicator - only visible when active */}
      <span
        className="absolute inset-0 hidden group-data-[state=active]:block"
        aria-hidden="true"
      >
        <motion.span
          layoutId="sliding-indicator"
          className="absolute inset-0 rounded-md bg-background shadow"
          initial={false}
          transition={
            shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION
          }
        />
      </span>
      {/* Content */}
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

// Re-export TabsContent from base tabs for convenience
const SlidingTabsContent = TabsPrimitive.Content;

export {
  SlidingTabs,
  SlidingTabsList,
  SlidingTabsTrigger,
  SlidingTabsContent,
};
```

## Alternative Approaches Considered

### 1. Pure CSS with useRef Measurements

Measure tab positions with refs, animate with CSS transitions.

```tsx
// Would require ~50 more lines for measurement logic
const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

useEffect(() => {
  const tab = tabRefs.current.get(activeValue);
  if (tab) {
    setIndicatorStyle({ left: tab.offsetLeft, width: tab.clientWidth });
  }
}, [activeValue]);
```

**Rejected because:**
- More code and edge cases (resize handling, SSR)
- Framer Motion already installed, so no bundle benefit
- Manual measurements less reliable than layoutId

### 2. CSS-Only with Radio Buttons

Hidden radio inputs + sibling selectors.

**Rejected because:**
- Poor accessibility (radios aren't semantically tabs)
- Requires knowing tab count at build time
- Can't handle variable-width tabs
- Project already has Radix tabs for accessibility

### 3. Modify Existing tabs.tsx

Add animation directly to current component.

**Rejected because:**
- Risk breaking existing usages (auth-form.tsx)
- Adds complexity to a simple component
- Separate variant is cleaner and follows shadcn patterns

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| Framer Motion | Installed (12.23.12) | Uses layoutId, LayoutGroup, useReducedMotion |
| @radix-ui/react-tabs | Installed (1.1.13) | Base primitives |
| React 19 | Installed | useId hook |

No new dependencies required.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| layoutId conflicts with multiple instances | Medium | High | Use LayoutGroup with useId per SlidingTabsList |
| Animation on initial render looks jarring | Low | Medium | Use `initial={false}` on motion component |
| Indicator covers tab text | Low | High | Use z-index: text (z-10) above indicator |
| Reduced motion not respected | Low | High | Use useReducedMotion hook |
| Breaking existing tabs usage | None | High | New component, existing tabs unchanged |

## Future Considerations

- **Custom indicator colors:** Add `indicatorClassName` prop
- **Animation customization:** Expose `transition` prop
- **Vertical tabs:** May need different indicator positioning
- **Tab overflow:** Scrollable tabs with indicator visibility

## Documentation Plan

1. JSDoc on all exported components (included in MVP)
2. Usage example in component file
3. Consider adding to project's component documentation if exists

## References

### Internal References

- Existing tabs component: `components/ui/tabs.tsx`
- Framer Motion spring pattern: `components/ring-percentage.tsx`
- Animation wrapper pattern: `features/ticket-card/components/animated-ticket-card-wrapper.tsx`
- Utility function: `lib/utils.ts`

### External References

- [Framer Motion Layout Animations](https://motion.dev/docs/react-layout-animations)
- [Build UI - Animated Tabs Recipe](https://buildui.com/recipes/animated-tabs)
- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs)
- [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)

---

## Commit Message

```
feat(ui): Add sliding tabs component with animated indicator

- Create SlidingTabs, SlidingTabsList, SlidingTabsTrigger components
- Use Framer Motion layoutId for smooth sliding animation
- Support multiple independent instances via LayoutGroup
- Respect prefers-reduced-motion accessibility setting
- Follow shadcn/ui patterns (data-slot, cn(), JSDoc)
```
