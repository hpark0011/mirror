/**
 * @jest-environment jsdom
 */
import { render, screen, renderHook, act } from '@testing-library/react';
import { useProjectFilter } from '../use-project-filter';
import React from 'react';

// DO NOT mock useLocalStorage - we want to test the real implementation
// to verify same-tab synchronization works correctly

describe('useProjectFilter', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should initialize with empty selectedProjectIds', () => {
    const { result } = renderHook(() => useProjectFilter());

    expect(result.current.selectedProjectIds).toEqual([]);
  });

  it('should toggle a project on', () => {
    const { result } = renderHook(() => useProjectFilter());

    act(() => {
      result.current.toggleProject('project-1');
    });

    expect(result.current.selectedProjectIds).toEqual(['project-1']);
  });

  it('should toggle a project off', () => {
    const { result } = renderHook(() => useProjectFilter());

    act(() => {
      result.current.toggleProject('project-1');
    });

    expect(result.current.selectedProjectIds).toEqual(['project-1']);

    act(() => {
      result.current.toggleProject('project-1');
    });

    expect(result.current.selectedProjectIds).toEqual([]);
  });

  it('should toggle multiple projects', () => {
    const { result } = renderHook(() => useProjectFilter());

    act(() => {
      result.current.toggleProject('project-1');
      result.current.toggleProject('project-2');
    });

    expect(result.current.selectedProjectIds).toEqual(['project-1', 'project-2']);
  });

  it('should clear all filters', () => {
    const { result } = renderHook(() => useProjectFilter());

    act(() => {
      result.current.toggleProject('project-1');
      result.current.toggleProject('project-2');
    });

    expect(result.current.selectedProjectIds).toEqual(['project-1', 'project-2']);

    act(() => {
      result.current.clearFilter();
    });

    expect(result.current.selectedProjectIds).toEqual([]);
  });

  it('should persist to localStorage', () => {
    const { result } = renderHook(() => useProjectFilter());

    act(() => {
      result.current.toggleProject('project-1');
    });

    // Check localStorage was updated
    const stored = localStorage.getItem('docgen.v1.tasks.project-filter');
    expect(stored).toBe('["project-1"]');
  });

  it('should load from localStorage on mount', () => {
    // Pre-populate localStorage
    localStorage.setItem('docgen.v1.tasks.project-filter', '["project-1","project-2"]');

    const { result } = renderHook(() => useProjectFilter());

    // Should eventually load from localStorage
    // Use waitFor since loading happens in useEffect
    expect(result.current.selectedProjectIds).toEqual(['project-1', 'project-2']);
  });
});

// Critical test: Same-tab synchronization
describe('useProjectFilter - Same-Tab Synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should synchronize filter changes across multiple hook instances in same tab', async () => {
    // Simulate two components using the same hook (like ProjectFilter and Board)
    const { result: filterComponent } = renderHook(() => useProjectFilter());
    const { result: boardComponent } = renderHook(() => useProjectFilter());

    // Initially both should be empty
    expect(filterComponent.current.selectedProjectIds).toEqual([]);
    expect(boardComponent.current.selectedProjectIds).toEqual([]);

    // User clicks filter in ProjectFilter component
    await act(async () => {
      filterComponent.current.toggleProject('project-1');
      // Wait for microtask to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // ProjectFilter component updates
    expect(filterComponent.current.selectedProjectIds).toEqual(['project-1']);

    // Board component should ALSO update immediately (same-tab sync)
    expect(boardComponent.current.selectedProjectIds).toEqual(['project-1']);
  });

  it('should synchronize multiple filter changes', async () => {
    const { result: instance1 } = renderHook(() => useProjectFilter());
    const { result: instance2 } = renderHook(() => useProjectFilter());

    // Toggle multiple projects
    await act(async () => {
      instance1.current.toggleProject('project-1');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(instance1.current.selectedProjectIds).toEqual(['project-1']);
    expect(instance2.current.selectedProjectIds).toEqual(['project-1']);

    await act(async () => {
      instance1.current.toggleProject('project-2');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(instance1.current.selectedProjectIds).toEqual(['project-1', 'project-2']);
    expect(instance2.current.selectedProjectIds).toEqual(['project-1', 'project-2']);

    // Toggle off from instance2
    await act(async () => {
      instance2.current.toggleProject('project-1');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(instance1.current.selectedProjectIds).toEqual(['project-2']);
    expect(instance2.current.selectedProjectIds).toEqual(['project-2']);
  });

  it('should clear filters across all instances', async () => {
    const { result: instance1 } = renderHook(() => useProjectFilter());
    const { result: instance2 } = renderHook(() => useProjectFilter());

    await act(async () => {
      instance1.current.toggleProject('project-1');
      instance1.current.toggleProject('project-2');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(instance1.current.selectedProjectIds).toEqual(['project-1', 'project-2']);
    expect(instance2.current.selectedProjectIds).toEqual(['project-1', 'project-2']);

    // Clear from one instance
    await act(async () => {
      instance2.current.clearFilter();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Both should be cleared
    expect(instance1.current.selectedProjectIds).toEqual([]);
    expect(instance2.current.selectedProjectIds).toEqual([]);
  });
});

// Integration test simulating real board filtering behavior
describe('Board Filter Integration - Real Behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should filter board tickets immediately when user selects a project', async () => {
    const tickets = [
      { id: 'ticket-1', title: 'Ticket 1', projectId: 'project-1' },
      { id: 'ticket-2', title: 'Ticket 2', projectId: 'project-2' },
      { id: 'ticket-3', title: 'Ticket 3', projectId: 'project-3' },
    ];

    // Component simulating ProjectFilter (user controls)
    const FilterControls = ({ onFilterChange }: { onFilterChange: (count: number) => void }) => {
      const { selectedProjectIds, toggleProject } = useProjectFilter();

      React.useEffect(() => {
        onFilterChange(selectedProjectIds.length);
      }, [selectedProjectIds, onFilterChange]);

      return (
        <div>
          <button data-testid="toggle-project-1" onClick={() => toggleProject('project-1')}>
            Toggle Project 1
          </button>
          <button data-testid="toggle-project-2" onClick={() => toggleProject('project-2')}>
            Toggle Project 2
          </button>
        </div>
      );
    };

    // Component simulating Board (displays filtered results)
    const BoardDisplay = () => {
      const { selectedProjectIds } = useProjectFilter();

      const filteredTickets = React.useMemo(() => {
        if (selectedProjectIds.length === 0) {
          return tickets;
        }
        return tickets.filter(ticket =>
          ticket.projectId && selectedProjectIds.includes(ticket.projectId)
        );
      }, [selectedProjectIds]);

      return (
        <div>
          <div data-testid="ticket-count">{filteredTickets.length}</div>
          <div data-testid="filter-count">{selectedProjectIds.length}</div>
          {filteredTickets.map(ticket => (
            <div key={ticket.id} data-testid={`ticket-${ticket.id}`}>
              {ticket.title}
            </div>
          ))}
        </div>
      );
    };

    let filterChangeCount = 0;
    const App = () => {
      const handleFilterChange = React.useCallback(() => {
        filterChangeCount++;
      }, []);

      return (
        <div>
          <FilterControls onFilterChange={handleFilterChange} />
          <BoardDisplay />
        </div>
      );
    };

    const { getByTestId } = render(<App />);

    // Initially all tickets visible
    expect(getByTestId('ticket-count')).toHaveTextContent('3');
    expect(getByTestId('filter-count')).toHaveTextContent('0');
    expect(screen.getByTestId('ticket-ticket-1')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-ticket-2')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-ticket-3')).toBeInTheDocument();

    // User clicks to filter by project-1
    await act(async () => {
      getByTestId('toggle-project-1').click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Board should IMMEDIATELY show only project-1 tickets (no refresh needed)
    expect(getByTestId('ticket-count')).toHaveTextContent('1');
    expect(getByTestId('filter-count')).toHaveTextContent('1');
    expect(screen.getByTestId('ticket-ticket-1')).toBeInTheDocument();
    expect(screen.queryByTestId('ticket-ticket-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ticket-ticket-3')).not.toBeInTheDocument();

    // User adds project-2 to filter
    await act(async () => {
      getByTestId('toggle-project-2').click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Board should show both project-1 and project-2 tickets
    expect(getByTestId('ticket-count')).toHaveTextContent('2');
    expect(getByTestId('filter-count')).toHaveTextContent('2');
    expect(screen.getByTestId('ticket-ticket-1')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-ticket-2')).toBeInTheDocument();
    expect(screen.queryByTestId('ticket-ticket-3')).not.toBeInTheDocument();

    // User removes project-1 from filter
    await act(async () => {
      getByTestId('toggle-project-1').click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Board should show only project-2
    expect(getByTestId('ticket-count')).toHaveTextContent('1');
    expect(getByTestId('filter-count')).toHaveTextContent('1');
    expect(screen.queryByTestId('ticket-ticket-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('ticket-ticket-2')).toBeInTheDocument();
    expect(screen.queryByTestId('ticket-ticket-3')).not.toBeInTheDocument();

    // Verify filter changes triggered board updates
    expect(filterChangeCount).toBeGreaterThan(0);
  });

  it('should handle filter updates without browser refresh', async () => {
    // This is the critical test that ensures the bug is fixed

    const BoardWithFilter = () => {
      const { selectedProjectIds, toggleProject } = useProjectFilter();
      const [updateCount, setUpdateCount] = React.useState(0);

      // Track how many times the component re-renders with new filter data
      React.useEffect(() => {
        setUpdateCount(prev => prev + 1);
      }, [selectedProjectIds]);

      return (
        <div>
          <div data-testid="update-count">{updateCount}</div>
          <div data-testid="selected-count">{selectedProjectIds.length}</div>
          <button onClick={() => toggleProject('project-1')}>Toggle</button>
        </div>
      );
    };

    const { getByTestId, getByText } = render(<BoardWithFilter />);

    // Initial render
    expect(getByTestId('update-count')).toHaveTextContent('1');
    expect(getByTestId('selected-count')).toHaveTextContent('0');

    // Click to apply filter
    await act(async () => {
      getByText('Toggle').click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Component should re-render with new filter (update count increases)
    expect(getByTestId('update-count')).toHaveTextContent('2');
    expect(getByTestId('selected-count')).toHaveTextContent('1');

    // This proves the component updated WITHOUT a browser refresh
  });
});
