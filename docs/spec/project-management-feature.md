# Project Management Feature Specification

**Feature**: Project Assignment for Tickets
**Status**: Planning
**Created**: 2025-10-14

## Overview

Add a project management system to the ticket form dialog that allows users to assign tickets to projects. The implementation will follow Notion's select property pattern, providing inline create, edit, and delete operations for projects directly within the dropdown. All data will be persisted in localStorage.

## User Requirements

- Users can assign a ticket to a project (optional field)
- Users can create new projects inline from the dropdown
- Users can edit existing projects inline
- Users can delete projects inline with confirmation
- Projects are color-coded for visual distinction
- Project assignment persists across sessions via localStorage

## Technical Architecture

### Data Model

#### Project Interface
```typescript
interface Project {
  id: string;           // Unique identifier (e.g., "project-{timestamp}")
  name: string;         // Project name
  color: ProjectColor;  // Color identifier
}

type ProjectColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";
```

#### Ticket Interface Update
```typescript
interface Ticket {
  id: string;
  title: string;
  description: string;
  status: ColumnId;
  projectId?: string;  // NEW: Optional project reference
  createdAt: Date;
  updatedAt: Date;
}
```

### Storage Strategy

- **Storage Key**: `getStorageKey("TASKS", "PROJECTS")` → `"docgen.v1.tasks.projects"`
- **Format**: JSON array of `Project[]`
- **Persistence**: localStorage with cross-tab synchronization
- **Migration**: Existing tickets without `projectId` remain valid (backward compatible)
- **Key Management**: Uses centralized storage key system from `@/lib/storage-keys`

### Components

#### 1. `hooks/use-projects.ts` (NEW)

Custom React hook for project management.

**API:**
```typescript
interface UseProjectsReturn {
  projects: Project[];
  addProject: (name: string, color: ProjectColor) => Project;
  updateProject: (id: string, updates: Partial<Omit<Project, 'id'>>) => void;
  deleteProject: (id: string) => void;
  getProjectById: (id: string) => Project | undefined;
}
```

**Implementation:**
```typescript
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

const STORAGE_KEY = getStorageKey("TASKS", "PROJECTS");

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useLocalStorage<Project[]>(STORAGE_KEY, []);
  // ... implementation
}
```

**Features:**
- Uses `useLocalStorage` hook for persistence
- Validates project names (non-empty, max length)
- Generates unique IDs for new projects
- Handles cross-tab storage events
- Uses centralized storage key management

#### 2. `components/tasks/project-select.tsx` (NEW)

Main UI component for project selection and management.

**Props:**
```typescript
interface ProjectSelectProps {
  value?: string;           // Selected project ID
  onValueChange: (projectId: string | undefined) => void;
  className?: string;
}
```

**UI Structure:**
```
[Trigger Button: "Project Name" or "No project"]
  ↓ (opens)
[Dropdown Content]
  ├─ [Project Item 1] ● Name [Edit] [Delete]
  ├─ [Project Item 2] ● Name [Edit] [Delete]
  ├─ ...
  ├─ [Separator]
  ├─ [Clear Selection] (if project selected)
  └─ [Create New Project]
       ↓ (expands inline)
       [Input Field] [Color Picker] [Save] [Cancel]
```

**Interactions:**
- Click trigger to open dropdown
- Click project to select/deselect
- Click edit icon to enter inline edit mode
- Click delete icon to show confirmation dialog
- Click "Create New Project" to show inline creation form
- Color picker shows 8 preset colors with visual swatches
- Escape key closes dropdown
- Enter key in input saves project

**States:**
- Default: List of projects
- Creating: Inline creation form visible
- Editing: Inline edit form for specific project
- Deleting: Confirmation dialog overlay

#### 3. `components/tasks/ticket-form-dialog.tsx` (UPDATE)

Add project field to ticket form.

**Changes:**
- Import `ProjectSelect` component
- Add `projectId` field to form schema (optional string)
- Render `ProjectSelect` in footer, left side before status dropdown
- Include `projectId` in form submission data

**Layout:**
```
[Dialog]
  [Title Input]
  [Description Textarea]
  ---
  [Footer]
    [ProjectSelect] [Status Dropdown] | [Cancel] [Submit]
```

#### 4. `components/tasks/ticket-card.tsx` (UPDATE)

Display project badge on ticket cards.

**Changes:**
- Import `useProjects` hook
- Lookup project by `ticket.projectId`
- Render project badge if assigned
- Badge shows colored dot + project name
- Position below title, above status

**Visual Design:**
```
[Card]
  [Title]
  [Project Badge] ● Project Name  <-- NEW
  [Status Badge]
  [Description preview]
```

#### 5. `lib/storage.ts` (UPDATE)

Ensure serialization handles new `projectId` field.

**Changes:**
- Update `serializeBoardData` to handle `projectId`
- Update `deserializeBoardData` to handle `projectId`
- Ensure backward compatibility (tickets without `projectId`)

## UI/UX Specifications

### Color Palette

8 preset colors with semantic CSS variable mappings:

| Color  | Hex     | CSS Variable          |
|--------|---------|----------------------|
| Gray   | #6B7280 | text-neutral-500     |
| Red    | #EF4444 | text-red-500         |
| Orange | #F97316 | text-orange-500      |
| Yellow | #EAB308 | text-yellow-500      |
| Green  | #10B981 | text-green-500       |
| Blue   | #3B82F6 | text-blue-500        |
| Purple | #A855F7 | text-purple-500      |
| Pink   | #EC4899 | text-pink-500        |

### Spacing and Sizing

- Project badge: `h-5`, `px-2`, `rounded-full`
- Color dot: `size-2`, `rounded-full`
- Dropdown width: `min-w-[280px]`
- Input fields: Standard form field sizing from design system

### Accessibility

- All interactive elements keyboard accessible
- ARIA labels for icon buttons (edit, delete)
- Focus management for inline forms
- Screen reader announcements for project changes
- Proper contrast ratios for color indicators

### Animations

- Dropdown: Radix UI default fade + slide animations
- Inline form transitions: 200ms ease
- Delete confirmation: 150ms fade overlay

## Testing Strategy

### Testing Framework

**Jest** with React Testing Library

**Dependencies:**
```bash
pnpm add -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest ts-jest
```

### Test Configuration

**`jest.config.js`**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
};
```

**`jest.setup.js`**
```javascript
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

global.localStorage = localStorageMock;
```

### Test Suites

#### 1. `hooks/use-projects.test.ts`

**Unit Tests:**
- ✓ Creates project with valid name and color
- ✓ Generates unique ID for new projects
- ✓ Updates project name successfully
- ✓ Updates project color successfully
- ✓ Deletes project by ID
- ✓ Returns undefined for non-existent project
- ✓ Persists projects to localStorage
- ✓ Loads projects from localStorage on mount
- ✓ Rejects empty project names
- ✓ Synchronizes across tabs via storage events

#### 2. `components/tasks/project-select.test.tsx`

**Component Tests:**
- ✓ Renders trigger with "No project" when no selection
- ✓ Renders trigger with project name when selected
- ✓ Opens dropdown on trigger click
- ✓ Displays list of existing projects
- ✓ Shows empty state when no projects exist
- ✓ Selects project on item click
- ✓ Deselects project on clear button click
- ✓ Shows create form on "Create New Project" click
- ✓ Creates new project with name and color
- ✓ Validates project name input (non-empty)
- ✓ Shows edit form on edit button click
- ✓ Updates project name in edit mode
- ✓ Updates project color in edit mode
- ✓ Shows confirmation dialog on delete button click
- ✓ Deletes project after confirmation
- ✓ Cancels delete operation
- ✓ Closes dropdown on Escape key
- ✓ Navigates with keyboard (arrow keys)
- ✓ Displays color indicator for each project
- ✓ Calls onValueChange with correct project ID

#### 3. `components/tasks/ticket-form-dialog.test.tsx`

**Integration Tests:**
- ✓ Renders project select field in form
- ✓ Submits form with project assigned
- ✓ Submits form without project (optional)
- ✓ Retains project selection when editing ticket
- ✓ Clears project selection on form reset
- ✓ Validates form with all fields including project
- ✓ Shows project in default values for edit mode
- ✓ Updates project when changed in form
- ✓ Preserves other form values when changing project

#### 4. `components/tasks/ticket-card.test.tsx`

**Component Tests:**
- ✓ Displays project badge when ticket has project
- ✓ Does not display badge when ticket has no project
- ✓ Shows correct project name from ID lookup
- ✓ Shows correct color indicator
- ✓ Handles deleted project gracefully (shows nothing)

### Coverage Goals

- **Minimum**: 80% coverage across all new code
- **Target**: 90%+ for hooks and core logic
- **Critical paths**: 100% for project CRUD operations

### Test Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

## Implementation Checklist

### Phase 1: Setup & Foundation
- [ ] Install Jest and testing dependencies
- [ ] Create Jest configuration files
- [ ] Setup test environment with localStorage mock
- [ ] Update type definitions in `types/board.types.ts`
- [ ] Verify backward compatibility with existing data

### Phase 2: Projects Hook
- [ ] Create `hooks/use-projects.ts`
- [ ] Implement CRUD operations
- [ ] Add localStorage persistence
- [ ] Write unit tests (`hooks/use-projects.test.ts`)
- [ ] Verify 90%+ test coverage

### Phase 3: Project Select Component
- [ ] Create `components/tasks/project-select.tsx`
- [ ] Implement dropdown with project list
- [ ] Add inline create functionality
- [ ] Add inline edit functionality
- [ ] Add delete with confirmation
- [ ] Implement color picker
- [ ] Add keyboard navigation
- [ ] Write component tests (`components/tasks/project-select.test.tsx`)
- [ ] Verify accessibility with screen reader

### Phase 4: Form Integration
- [ ] Update `components/tasks/ticket-form-dialog.tsx`
- [ ] Add project field to form schema
- [ ] Integrate ProjectSelect component
- [ ] Update form submission logic
- [ ] Write integration tests (`components/tasks/ticket-form-dialog.test.tsx`)
- [ ] Test edit mode with existing projects

### Phase 5: Card Display
- [ ] Update `components/tasks/ticket-card.tsx`
- [ ] Add project badge rendering
- [ ] Style badge with colors
- [ ] Handle missing/deleted projects
- [ ] Write component tests

### Phase 6: Storage Migration
- [ ] Update `lib/storage.ts` serialization
- [ ] Test import/export with projects
- [ ] Verify backward compatibility
- [ ] Test with existing board data

### Phase 7: Testing & Polish
- [ ] Run full test suite (`pnpm test`)
- [ ] Verify coverage meets goals (`pnpm test:coverage`)
- [ ] Manual testing: create/edit/delete flows
- [ ] Cross-tab synchronization testing
- [ ] Accessibility audit
- [ ] Performance testing with many projects (100+)

## Success Criteria

### Functional Requirements
- ✓ Users can create projects with name and color
- ✓ Users can assign tickets to projects
- ✓ Users can edit project details inline
- ✓ Users can delete projects with confirmation
- ✓ Project selection is optional (tickets work without projects)
- ✓ Projects persist across sessions
- ✓ Projects sync across browser tabs

### Quality Requirements
- ✓ Test coverage ≥ 80% overall
- ✓ Zero TypeScript errors
- ✓ Passes `pnpm lint`
- ✓ No console warnings in development
- ✓ Accessibility: WCAG 2.1 AA compliant

### Performance Requirements
- ✓ Dropdown opens in < 100ms
- ✓ Project creation completes in < 50ms
- ✓ Handles 100+ projects without lag
- ✓ localStorage operations batched to prevent blocking

## Future Enhancements

### v2 Features (Out of Scope)
- Project descriptions and metadata
- Project archiving (soft delete)
- Project search/filter in dropdown
- Recently used projects section
- Project templates
- Project-based filtering for board view
- Export projects separately
- Drag-to-reorder projects

### Technical Debt
- Consider IndexedDB for large datasets
- Add project usage analytics
- Implement undo/redo for project operations
- Add bulk project operations

## References

- [Notion Database Properties](https://www.notion.so/help/database-properties)
- [Radix UI Select](https://www.radix-ui.com/primitives/docs/components/select)
- [React Hook Form](https://react-hook-form.com/api/useform)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## Changelog

### 2025-10-14 - Initial Specification
- Created specification document
- Defined data models and component architecture
- Outlined testing strategy with Jest
- Established success criteria
