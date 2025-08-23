'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
} from '@dnd-kit/sortable';
import { BoardColumn } from './board-column';
import { TicketCard } from './ticket-card';
import { Ticket, BoardState, ColumnId } from './types';
import { TicketForm } from './ticket-form';

const COLUMNS = [
  { id: 'not-started' as ColumnId, title: 'Not Started' },
  { id: 'in-progress' as ColumnId, title: 'In Progress' },
  { id: 'complete' as ColumnId, title: 'Complete' },
] as const;

export function TrelloBoard() {
  const [board, setBoard] = useState<BoardState>({
    'not-started': [
      {
        id: 'test-ticket-1',
        title: 'Test Ticket 1',
        description: 'This is a test ticket for debugging',
        status: 'not-started',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
    'in-progress': [],
    'complete': [],
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [formColumnId, setFormColumnId] = useState<ColumnId>('not-started');

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  
  console.log('🎮 Board State:', {
    columns: Object.keys(board),
    ticketCounts: Object.entries(board).map(([col, tickets]) => ({
      column: col,
      count: tickets.length,
      ids: tickets.map(t => t.id)
    })),
    sensors: !!sensors,
  });

  const handleDragStart = (event: DragStartEvent) => {
    console.log('🎯 DRAG START:', {
      activeId: event.active.id,
      data: event.active.data,
    });
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    console.log('🔄 DRAG OVER:', {
      activeId: active.id,
      overId: over?.id,
      overData: over?.data,
    });
    
    if (!over) {
      console.log('❌ No over element, returning');
      return;
    }

    const activeColumn = findColumn(active.id as string);
    // Check if we're over a column directly or over a ticket in a column
    let overColumn: string | null;
    if (board[over.id as string]) {
      // Dragged over a column directly
      overColumn = over.id as string;
    } else {
      // Dragged over a ticket - find its column
      overColumn = findColumn(over.id as string);
    }
    
    console.log('📍 Column detection:', {
      activeColumn,
      overColumn,
      isOverColumnDirectly: over.id in board,
      boardKeys: Object.keys(board),
    });

    if (!activeColumn || !overColumn || activeColumn === overColumn) {
      console.log('⏭️ Skipping drag over:', {
        hasActiveColumn: !!activeColumn,
        hasOverColumn: !!overColumn,
        sameColumn: activeColumn === overColumn,
      });
      return;
    }

    setBoard((board) => {
      const activeItems = [...board[activeColumn]];
      const overItems = [...board[overColumn]];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      const activeItem = activeItems[activeIndex];
      
      console.log('🚀 Moving between columns:', {
        from: activeColumn,
        to: overColumn,
        itemId: active.id,
        activeIndex,
      });
      
      if (activeIndex === -1 || !activeItem) {
        console.error('❌ Cannot find item to move');
        return board;
      }
      
      activeItems.splice(activeIndex, 1);
      
      const updatedActiveItem = {
        ...activeItem,
        status: overColumn as ColumnId,
        updatedAt: new Date(),
      };
      
      overItems.push(updatedActiveItem);
      
      console.log('📦 Updated board state:', {
        [activeColumn]: activeItems.length,
        [overColumn]: overItems.length,
      });

      return {
        ...board,
        [activeColumn]: activeItems,
        [overColumn]: overItems,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log('🏁 DRAG END:', {
      activeId: active.id,
      overId: over?.id,
    });
    
    if (!over) {
      console.log('❌ No drop target');
      return;
    }

    const activeColumn = findColumn(active.id as string);
    // Check if we're over a column directly or over a ticket in a column
    let overColumn: string | null;
    if (board[over.id as string]) {
      // Dragged over a column directly
      overColumn = over.id as string;
    } else {
      // Dragged over a ticket - find its column
      overColumn = findColumn(over.id as string);
    }
    
    console.log('📊 Final positions:', {
      activeColumn,
      overColumn,
      isOverColumnDirectly: over.id in board,
    });

    if (!activeColumn || !overColumn) {
      console.log('❌ Missing columns');
      return;
    }

    if (activeColumn === overColumn) {
      console.log('🔀 Reordering within same column');
      setBoard((board) => {
        const items = [...board[activeColumn]];
        const activeIndex = items.findIndex((t) => t.id === active.id);
        const overIndex = items.findIndex((t) => t.id === over.id);

        console.log('📐 Reorder indices:', { activeIndex, overIndex });
        if (activeIndex !== overIndex) {
          console.log('✅ Reordering items');
          return {
            ...board,
            [activeColumn]: arrayMove(items, activeIndex, overIndex),
          };
        }
        console.log('⏭️ Same position, no change');
        return board;
      });
    }

    setActiveId(null);
  };

  const findColumn = (id: string): string | null => {
    console.log('🔍 Finding column for ID:', id);
    for (const [columnId, tickets] of Object.entries(board)) {
      if (tickets.some((t) => t.id === id)) {
        console.log(`✅ Found in column: ${columnId}`);
        return columnId;
      }
    }
    console.log('❌ ID not found in any column');
    return null;
  };

  const findTicket = (id: string): Ticket | null => {
    for (const tickets of Object.values(board)) {
      const ticket = tickets.find((t) => t.id === id);
      if (ticket) return ticket;
    }
    return null;
  };

  const handleAddTicket = (columnId: ColumnId) => {
    setFormColumnId(columnId);
    setEditingTicket(null);
    setIsFormOpen(true);
  };

  const handleEditTicket = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setFormColumnId(ticket.status);
    setIsFormOpen(true);
  };

  const handleDeleteTicket = (ticketId: string) => {
    const column = findColumn(ticketId);
    if (!column) return;

    setBoard((board) => ({
      ...board,
      [column]: board[column].filter((t) => t.id !== ticketId),
    }));
  };

  const handleFormSubmit = (data: { title: string; description: string; status: ColumnId }) => {
    if (editingTicket) {
      const oldColumn = findColumn(editingTicket.id);
      if (!oldColumn) return;

      setBoard((board) => {
        const updatedTicket: Ticket = {
          ...editingTicket,
          title: data.title,
          description: data.description,
          status: data.status,
          updatedAt: new Date(),
        };

        if (oldColumn === data.status) {
          return {
            ...board,
            [oldColumn]: board[oldColumn].map((t) =>
              t.id === editingTicket.id ? updatedTicket : t
            ),
          };
        } else {
          return {
            ...board,
            [oldColumn]: board[oldColumn].filter((t) => t.id !== editingTicket.id),
            [data.status]: [...board[data.status], updatedTicket],
          };
        }
      });
    } else {
      const newTicket: Ticket = {
        id: `ticket-${Date.now()}`,
        title: data.title,
        description: data.description,
        status: data.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setBoard((board) => ({
        ...board,
        [data.status]: [...board[data.status], newTicket],
      }));
    }

    setIsFormOpen(false);
    setEditingTicket(null);
  };

  const activeTicket = activeId ? findTicket(activeId) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-4 overflow-x-auto min-h-screen bg-gray-50">
          {COLUMNS.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tickets={board[column.id]}
              onAddTicket={() => handleAddTicket(column.id)}
              onEditTicket={handleEditTicket}
              onDeleteTicket={handleDeleteTicket}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTicket ? <TicketCard ticket={activeTicket} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      <TicketForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        defaultValues={
          editingTicket
            ? {
                title: editingTicket.title,
                description: editingTicket.description,
                status: editingTicket.status,
              }
            : {
                title: '',
                description: '',
                status: formColumnId,
              }
        }
        mode={editingTicket ? 'edit' : 'create'}
      />
    </>
  );
}