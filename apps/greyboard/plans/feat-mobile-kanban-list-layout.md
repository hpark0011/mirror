# feat: Mobile Kanban List Layout

> **Simplified after review by DHH, Kieran, and Code Simplicity reviewers.**
> Original plan was over-engineered. This version creates 0 new files.

## Overview

Transform the kanban board into a mobile-friendly grouped list layout that switches automatically at the `md` breakpoint (768px). On mobile, the 4-column horizontal kanban becomes vertically stacked collapsible groups, each maintaining drag-and-drop reordering and cross-group movement.

## Problem Statement

The current kanban board implementation uses fixed column widths (`w-1/3`) with horizontal scrolling, which creates poor UX on mobile:

- Requires horizontal scrolling to see all columns
- Touch targets may be too small
- Hover-based action toolbar is inaccessible on touch devices
- No responsive breakpoints in board layout

**Reference:** `features/kanban-board/components/board-column.tsx:44` - hardcoded `w-1/3`

## Proposed Solution

Extend existing components with responsive Tailwind classes and a single `useState` for collapse behavior. **No new files required.**

```
Mobile (<768px)           Desktop (>=768px)
┌─────────────────┐       ┌────┬────┬────┬────┐
│ Backlog (3) ▼   │       │Back│ToDo│Prog│Done│
│ • Ticket 1      │       │    │    │    │    │
│ • Ticket 2      │       │    │    │    │    │
├─────────────────┤       │    │    │    │    │
│ To Do (2) ▶     │       │    │    │    │    │
├─────────────────┤       └────┴────┴────┴────┘
│ In Progress (1) │
│ • Ticket 4 🟢   │
├─────────────────┤
│ Complete (5) ▶  │
└─────────────────┘
```

---

## Technical Approach

### Files to Modify

| File | Changes |
|------|---------|
| `features/kanban-board/components/board.tsx` | Import existing `useIsMobile`, pass `isMobile` prop to columns |
| `features/kanban-board/components/board-column.tsx` | Add responsive styles + collapsible state for mobile |
| `features/kanban-board/components/board-column-header.tsx` | Add collapse toggle button for mobile |
| `components/layout/layout-ui.tsx` | Add responsive flex direction |
| `features/ticket-card/components/ticket-action-toolbar.tsx` | Mobile visibility (always show) |

### Files to Create

**None.** The existing `useIsMobile` hook at `hooks/use-mobile.ts` already handles SSR-safe viewport detection.

### Architecture Decision

Use **CSS-first responsive approach** with Tailwind breakpoints because:
1. Same DnD context works for both layouts (columns are just styled differently)
2. Simpler mental model - one component, two visual states
3. No component duplication or prop drilling through wrapper components

---

## Implementation Phases

### Phase 1: Core Mobile Layout

Modify existing components to support responsive behavior.

#### 1.1 Update `BodyContainer` for Responsive Layout

```typescript
// components/layout/layout-ui.tsx
export const BodyContainer = ({ children, className }: ContainerProps) => {
  return (
    <div
      className={cn(
        // Mobile: vertical stack with scroll
        "flex flex-col overflow-y-auto min-h-screen pt-20 px-4 gap-0",
        // Desktop: horizontal layout (existing behavior)
        "md:flex-row md:overflow-x-auto md:p-0",
        className
      )}
    >
      {children}
    </div>
  );
};
```

#### 1.2 Update `board.tsx` to Pass Mobile State

```typescript
// features/kanban-board/components/board.tsx
import { useIsMobile } from "@/hooks/use-mobile";

export function Board() {
  const isMobile = useIsMobile();

  // ... existing hooks

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        // ... handlers
      >
        <BodyContainer>
          {COLUMNS.map((column) => (
            <Fragment key={column.id}>
              <BoardColumn
                column={column}
                tickets={filteredBoard[column.id] || []}
                isMobile={isMobile}  // NEW: pass mobile state
                onAddTicket={() => openCreate(column.id)}
                onEditTicket={openEdit}
                onDeleteTicket={actions.deleteTicket}
                onClearColumn={
                  column.id === "complete"
                    ? () => actions.clearColumn("complete")
                    : undefined
                }
                onUpdateSubTasks={actions.updateSubTasks}
              />
              {/* Hide divider on mobile */}
              <div className="hidden md:block w-[1px] min-w-[1px] bg-neutral-200 dark:bg-neutral-900 last:hidden" />
            </Fragment>
          ))}
        </BodyContainer>
        <BoardDragOverlay activeTicket={activeTicket} />
      </DndContext>
      {/* ... TicketFormDialog */}
    </>
  );
}
```

#### 1.3 Update `BoardColumn` with Responsive Styles and Collapse

```typescript
// features/kanban-board/components/board-column.tsx
import { useState } from "react";

interface BoardColumnProps {
  // ... existing props
  isMobile?: boolean;  // NEW
}

export function BoardColumn({
  column,
  tickets,
  isMobile = false,
  onAddTicket,
  onEditTicket,
  onDeleteTicket,
  onClearColumn,
  onUpdateSubTasks,
}: BoardColumnProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card
      className={cn(
        // Mobile: full width, auto height, border bottom
        "w-full border-b border-neutral-200 dark:border-neutral-800",
        // Desktop: fixed column width, full height
        "md:w-1/4 md:h-[calc(100vh-80px)] md:border-b-0",
        // Shared
        "flex flex-col bg-transparent shadow-none rounded-none md:rounded-2xl py-0 gap-0 border-x-0 md:border-none"
      )}
    >
      <BoardColumnHeader
        column={column}
        ticketCount={tickets.length}
        onAddTicket={onAddTicket}
        onClearColumn={onClearColumn}
        // NEW: collapse props for mobile
        isMobile={isMobile}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
      />

      {/* Content - collapsible on mobile */}
      <div
        className={cn(
          "flex-1 overflow-hidden",
          // Mobile: animate collapse
          isMobile && !isExpanded && "max-h-0",
          isMobile && isExpanded && "max-h-none",
          // Desktop: always visible with scroll
          "md:max-h-none md:overflow-y-auto"
        )}
      >
        <SortableContext
          id={column.id}
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="px-4 md:px-2 pb-4 space-y-2">
            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No tickets
              </p>
            ) : (
              tickets.map((ticket, index) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  index={index}
                  onEdit={() => onEditTicket(ticket)}
                  onDelete={() => onDeleteTicket(ticket.id)}
                  onClick={() => onEditTicket(ticket)}
                  onSubTasksChange={(subTasks) =>
                    onUpdateSubTasks(ticket.id, subTasks)
                  }
                />
              ))
            )}
          </div>
        </SortableContext>

        {/* Add ticket button */}
        <div className="px-4 md:px-2 pb-4">
          <AddTicketButton onClick={onAddTicket} />
        </div>
      </div>
    </Card>
  );
}
```

#### 1.4 Update `BoardColumnHeader` with Collapse Toggle

```typescript
// features/kanban-board/components/board-column-header.tsx
import { ChevronDown } from "lucide-react";

interface BoardColumnHeaderProps {
  // ... existing props
  isMobile?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function BoardColumnHeader({
  column,
  ticketCount,
  onAddTicket,
  onClearColumn,
  isMobile = false,
  isExpanded = true,
  onToggleExpand,
}: BoardColumnHeaderProps) {
  return (
    <CardHeader
      className={cn(
        "flex flex-row items-center justify-between p-4 md:p-2",
        // Mobile: make header tappable for collapse
        isMobile && "cursor-pointer active:bg-neutral-100 dark:active:bg-neutral-800"
      )}
      onClick={isMobile ? onToggleExpand : undefined}
      role={isMobile ? "button" : undefined}
      aria-expanded={isMobile ? isExpanded : undefined}
      aria-label={isMobile ? `Toggle ${column.title} tickets` : undefined}
    >
      <div className="flex items-center gap-2">
        <Icon name={column.icon} className={cn("h-4 w-4", column.iconColor)} />
        <span className="font-medium">{column.title}</span>
        <span className="text-sm text-muted-foreground">({ticketCount})</span>
      </div>

      <div className="flex items-center gap-1">
        {/* Clear button for complete column */}
        {onClearColumn && ticketCount > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onClearColumn();
            }}
            className="h-8 w-8"
            aria-label="Clear completed tickets"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Add button - desktop only (mobile uses bottom button) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onAddTicket();
          }}
          className="hidden md:flex h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {/* Collapse chevron - mobile only */}
        {isMobile && (
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        )}
      </div>
    </CardHeader>
  );
}
```

---

### Phase 2: Touch Polish

Improve touch interactions for mobile.

#### 2.1 Update Ticket Action Toolbar Visibility

```typescript
// features/ticket-card/components/ticket-action-toolbar.tsx

// Change from hover-only to always visible on mobile
<div
  className={cn(
    "flex flex-row items-center gap-1",
    "absolute top-[5px] right-[5px]",
    // Mobile: always visible
    "opacity-100",
    // Desktop: hover reveal
    "md:opacity-0 md:group-hover:opacity-100",
    "pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto"
  )}
>
```

#### 2.2 Add Touch-Action to Ticket Cards (Optional)

If scroll/drag conflicts occur, add inline style to ticket cards:

```typescript
// features/ticket-card/components/ticket-card.tsx
<Card
  style={{ touchAction: "manipulation" }}
  // ... rest of props
>
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] Board displays as vertical grouped list on viewports < 768px
- [ ] Board displays as 4-column kanban on viewports >= 768px
- [ ] Each status group is collapsible with chevron indicator (mobile only)
- [ ] Groups show ticket count in header (e.g., "In Progress (3)")
- [ ] Tickets can be dragged within the same group to reorder
- [ ] Tickets can be dragged to different groups to change status
- [ ] "Add Ticket" button available at bottom of each group
- [ ] "Clear All" available in Complete group header
- [ ] Timer integration works same as desktop
- [ ] Sub-tasks display and edit inline on mobile

### Non-Functional Requirements

- [ ] Touch delay (250ms) prevents accidental drags during scroll
- [ ] Action toolbar visible on mobile (no hover dependency)
- [ ] No layout shift on viewport resize
- [ ] No hydration mismatch errors in console

### Quality Gates

- [ ] `pnpm lint` passes
- [ ] Manual test on iOS Safari and Chrome Android
- [ ] Test landscape orientation on mobile

---

## Summary of Changes

| File | Lines Changed | Description |
|------|---------------|-------------|
| `components/layout/layout-ui.tsx` | ~5 | Add responsive flex direction |
| `features/kanban-board/components/board.tsx` | ~10 | Import useIsMobile, pass to columns |
| `features/kanban-board/components/board-column.tsx` | ~30 | Add responsive styles + collapse state |
| `features/kanban-board/components/board-column-header.tsx` | ~25 | Add collapse toggle for mobile |
| `features/ticket-card/components/ticket-action-toolbar.tsx` | ~5 | Mobile visibility |

**Total: ~75 lines changed across 5 existing files. 0 new files.**

---

## What Was Removed (Per Review Feedback)

| Removed | Reason |
|---------|--------|
| `hooks/use-media-query.ts` | Already have `useIsMobile` at `hooks/use-mobile.ts` |
| `hooks/use-is-mobile.ts` | Duplicate of existing hook |
| `board-status-group.tsx` | 90% duplicate of `BoardColumn` |
| `board-mobile-view.tsx` | Wrapper that adds no value |
| Keyboard sensor changes | YAGNI - desktop concern, not mobile |
| Global CSS additions | Use inline Tailwind instead |
| localStorage persistence for collapse | YAGNI - session state is fine |
| Risk analysis matrix | Overkill for CSS changes |

---

## References

### Internal References

- Existing mobile hook: `hooks/use-mobile.ts`
- Board component: `features/kanban-board/components/board.tsx:105-135`
- Column component: `features/kanban-board/components/board-column.tsx:43-86`
- Column header: `features/kanban-board/components/board-column-header.tsx`
- Ticket toolbar: `features/ticket-card/components/ticket-action-toolbar.tsx:33-50`

### External References

- [@dnd-kit Touch Sensor Docs](https://docs.dndkit.com/api-documentation/sensors/touch)
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
