# Product Requirements Plan: Task Board

## Executive Summary

Implementation of a kanban-style task board with drag-and-drop functionality using @dnd-kit library. The board features four columns (Backlog, To Do, In Progress, Complete) with draggable tickets that can be created, edited, deleted, and moved between columns.

> **Note**: This document was originally created as a planning document. The task board is now fully implemented in `/components/tasks/`.

## Context & Requirements

### Project Context

- **Framework**: Next.js 15.4.7 with App Router, React 19, TypeScript 5
- **UI Library**: shadcn/ui components with Radix UI primitives (already installed)
- **State Management**: React Hook Form + Zod for forms
- **Data Fetching**: TanStack Query (if persistence needed)
- **Styling**: Tailwind CSS 4 with cn() utility from `@/lib/utils`
- **Component Pattern**: Data-slot attributes, compound components (see `/components/ui/card.tsx` and `/components/ui/dialog.tsx` for patterns)

### Core Requirements

1. **Three Columns**: Not Started, In Progress, Complete
2. **Ticket Management**:
   - Create new tickets with title, description, status
   - Edit existing tickets (inline or modal)
   - Delete tickets with confirmation
3. **Drag & Drop**: Smooth drag-and-drop between columns
4. **Persistence**: Local storage initially (can extend to API later)
5. **Responsive Design**: Works on desktop and mobile

## Research & References

### Documentation URLs

1. **@dnd-kit Documentation**: https://docs.dndkit.com/
2. **@dnd-kit Sortable Preset**: https://docs.dndkit.com/presets/sortable
3. **DND Kit Examples**: https://github.com/clauderic/dnd-kit/tree/master/stories
4. **DnD Kit Tutorial**: https://medium.com/@kurniawanc/create-multiple-drag-and-drop-list-like-trello-in-react-js-using-dnd-kit-library-b2acd9a65fab
5. **React Hook Form**: https://react-hook-form.com/docs
6. **Zod Schema Validation**: https://zod.dev/

### Key Implementation Patterns

From dnd-kit documentation:

- Use `DndContext` as root provider for drag operations
- Each column needs its own `SortableContext` with unique ID
- Items use `useSortable` hook for drag behavior
- Collision detection with `closestCenter` or `rectIntersection`
- Handle `onDragEnd` for same-column sorting
- Handle `onDragOver` for cross-column moves

## Implementation Blueprint

### Architecture Overview

```
┌─────────────────────────────────────────────┐
│                App Router Page               │
│            /app/dashboard/tasks              │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│              Board Component                 │
│           /components/tasks/board.tsx        │
│     (DndContext, state management, layout)   │
└─────────────────────┬───────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌───▼────┐ ┌─────▼──────┐
│ BoardColumn  │ │ Ticket │ │ TicketForm │
│  Component   │ │  Card  │ │  Dialog    │
└──────────────┘ └────────┘ └────────────┘
```

### File Structure

```
components/
├── tasks/
│   ├── board.tsx               # Main board component with DnD context
│   ├── board-column.tsx        # Column component with SortableContext
│   ├── ticket-card.tsx         # Individual draggable ticket
│   ├── ticket-form-dialog.tsx  # Form for creating/editing tickets
types/
│   └── board.types.ts          # TypeScript interfaces
lib/
│   └── storage.ts              # Local storage persistence
```

### Data Model

```typescript
// types/board.types.ts
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: "not-started" | "in-progress" | "complete";
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: "not-started" | "in-progress" | "complete";
  title: string;
  tickets: Ticket[];
}

export type BoardState = Record<string, Ticket[]>;
```

### Implementation Code Examples

```typescript
// 1. Main Board Component (components/tasks/board.tsx)
'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { BoardColumn } from './board-column';
import { TicketCard } from './ticket-card';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';
import { Ticket, BoardState } from './types';

const COLUMNS = [
  { id: 'not-started', title: 'Not Started' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'complete', title: 'Complete' },
] as const;

export function Board() {
  const [board, setBoard] = useState<BoardState>({
    'not-started': [],
    'in-progress': [],
    'complete': [],
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeColumn = findColumn(active.id as string);
    const overColumn = findColumn(over.id as string);

    if (!activeColumn || !overColumn || activeColumn === overColumn) {
      return;
    }

    setBoard((board) => {
      const activeItems = board[activeColumn];
      const overItems = board[overColumn];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      const [removedItem] = activeItems.splice(activeIndex, 1);

      return {
        ...board,
        [activeColumn]: activeItems,
        [overColumn]: [...overItems, removedItem],
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeColumn = findColumn(active.id as string);
    const overColumn = findColumn(over.id as string);

    if (!activeColumn || !overColumn) return;

    if (activeColumn === overColumn) {
      setBoard((board) => {
        const items = board[activeColumn];
        const activeIndex = items.findIndex((t) => t.id === active.id);
        const overIndex = items.findIndex((t) => t.id === over.id);

        return {
          ...board,
          [activeColumn]: arrayMove(items, activeIndex, overIndex),
        };
      });
    }

    setActiveId(null);
  };

  const findColumn = (id: string): string | null => {
    for (const [columnId, tickets] of Object.entries(board)) {
      if (columnId === id || tickets.some((t) => t.id === id)) {
        return columnId;
      }
    }
    return null;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4">
        {COLUMNS.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tickets={board[column.id]}
            onAddTicket={(ticket) => {
              setBoard((board) => ({
                ...board,
                [column.id]: [...board[column.id], ticket],
              }));
            }}
          />
        ))}
      </div>
      <DragOverlay>
        {activeId ? <TicketCard ticket={findTicket(activeId)} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// 2. Column Component (components/tasks/board-column.tsx)
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function BoardColumn({ column, tickets, onAddTicket }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <Card className="w-80 min-h-[500px]">
      <CardHeader>
        <CardTitle>{column.title}</CardTitle>
        <Button size="sm" onClick={() => openTicketForm(column.id)}>
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Ticket
        </Button>
      </CardHeader>
      <CardContent ref={setNodeRef}>
        <SortableContext
          id={column.id}
          items={tickets.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </SortableContext>
      </CardContent>
    </Card>
  );
}

// 3. Draggable Ticket (components/tasks/ticket-card.tsx)
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, Edit, Trash } from 'lucide-react';

export function TicketCard({ ticket, isDragging = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-2 cursor-move",
        isDragging && "rotate-3 scale-105"
      )}
    >
      <CardHeader className="p-3">
        <div className="flex items-start gap-2">
          <div {...attributes} {...listeners} className="cursor-grab">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm">{ticket.title}</CardTitle>
            <CardDescription className="text-xs mt-1">
              {ticket.description}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <Edit className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <Trash className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
```

## Implementation Tasks

### Phase 1: Core Setup

1. **Install Dependencies**

   ```bash
   pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

2. **Create Type Definitions**

   - Create `/types/board.types.ts`
   - Define Ticket, Column, BoardState interfaces
   - Export type utilities

3. **Setup Board Layout**
   - Create `/components/tasks/board.tsx`
   - Implement four-column layout (Backlog, To Do, In Progress, Complete)
   - Add DndContext provider

### Phase 2: Drag and Drop

4. **Implement Column Components**

   - Create `/components/tasks/board-column.tsx`
   - Setup SortableContext per column
   - Add useDroppable hook

5. **Create Draggable Tickets**

   - Create `/components/tasks/ticket-card.tsx`
   - Implement useSortable hook
   - Add drag handle with GripVertical icon

6. **Handle Drag Events**
   - Implement onDragStart, onDragOver, onDragEnd
   - Handle within-column sorting
   - Handle cross-column transfers

### Phase 3: CRUD Operations

7. **Create Ticket Form**

   - Create `/components/tasks/ticket-form-dialog.tsx`
   - Use React Hook Form + Zod
   - Implement in Dialog component
   - Fields: title (required), description, status

8. **Add Edit Functionality**

   - Reuse ticket form for editing
   - Pre-populate form with existing data
   - Update ticket on submission

9. **Implement Delete**
   - Add confirmation dialog using AlertDialog
   - Remove ticket from state
   - Update local storage

### Phase 5: Polish

11. **Add Animations**

    - Smooth drag animations
    - Card hover effects
    - Transition animations

12. **Mobile Responsiveness**

    - Horizontal scroll for columns
    - Touch-friendly drag handles
    - Responsive card sizes

13. **Accessibility**
    - Keyboard navigation support
    - Screen reader announcements
    - Focus management

## Gotchas & Solutions

### Known Issues

1. **React 19 Compatibility**

   - @dnd-kit may need React 18 peer dependency
   - Solution: Use `--force` or `--legacy-peer-deps` if needed
   - Or add to package.json overrides

2. **Hydration Mismatch**

   - DnD components must be client-side only
   - Solution: Use 'use client' directive
   - Load from localStorage in useEffect

3. **Touch Devices**

   - Default PointerSensor may not work well
   - Solution: Configure TouchSensor for mobile

4. **Performance with Many Items**
   - Re-renders on every drag movement
   - Solution: Use React.memo for ticket cards
   - Implement virtualization for large lists

## Success Criteria

- [ ] Three columns display correctly
- [ ] Can create new tickets with form validation
- [ ] Can drag tickets between columns
- [ ] Can reorder tickets within columns
- [ ] Can edit existing tickets
- [ ] Can delete tickets with confirmation
- [ ] Data persists on page refresh
- [ ] Works on desktop and mobile
- [ ] Accessible via keyboard
- [ ] No console errors or warnings

## Confidence Score

**8/10** - High confidence in one-pass implementation

### Reasoning

- Clear requirements and scope
- Well-documented dnd-kit library
- Existing UI components available
- Familiar patterns in codebase
- Straightforward data model

### Risk Factors

- Potential React 19 compatibility issues (mitigated with overrides)
- Complex drag-and-drop edge cases (documented solutions available)
- Mobile touch handling (configurable with sensors)
