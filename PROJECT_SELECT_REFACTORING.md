# Project Select Component Refactoring

## Overview

Refactor `components/tasks/project-select.tsx` (544 lines) into smaller, maintainable components following KISS and YAGNI principles.

**Current Issues:**

- Single component doing too much (selection, CRUD, search, keyboard nav)
- 9 separate useState hooks managing related state
- Code duplication (color picker, form submission)
- Mixed concerns (UI, business logic, state management)

**Goals:**

- Reduce component size to ~150 lines
- Improve testability and reusability
- Maintain existing functionality
- Follow project's React best practices

---

## Task Checklist

### Phase 1: Low-Risk Extractions (Start Here)

- [ ] **1.1 Extract DeleteProjectDialog Component**

  - Lines: 514-540
  - Estimated reduction: ~30 lines
  - Risk: Low (self-contained, no state dependencies)

- [ ] **1.2 Extract ProjectColorPicker Component**
  - Lines: 373-411 and 462-478 (deduplication)
  - Estimated reduction: ~40 lines
  - Risk: Low (pure UI component)

### Phase 2: Hook Extractions

- [ ] **2.1 Create use-keyboard-navigation Hook**

  - Logic: Lines 159-192 (handleSearchKeyDown)
  - File: `hooks/use-keyboard-navigation.ts`
  - Include JSDoc documentation
  - Estimated reduction: ~30 lines

- [ ] **2.2 Create use-project-search Hook**

  - Logic: Lines 68-83 (filtering, exact match, canCreateNew)
  - File: `hooks/use-project-search.ts`
  - Include JSDoc documentation
  - Estimated reduction: ~20 lines

- [ ] **2.3 Create use-project-form Hook**
  - State: projectName, selectedColor
  - Methods: reset, validate
  - File: `hooks/use-project-form.ts`
  - Include JSDoc documentation
  - Estimated reduction: ~15 lines

### Phase 3: Component Breakdown

- [ ] **3.1 Extract ProjectMenuItem Component**

  - Logic: Lines 277-345 (individual project row)
  - Features: hover state, edit/delete buttons, selection
  - File: `components/tasks/project-select/project-menu-item.tsx`
  - Estimated reduction: ~60 lines

- [ ] **3.2 Extract ProjectListView Component**

  - Logic: Lines 230-426 (search input, filtered list, create button)
  - File: `components/tasks/project-select/project-list-view.tsx`
  - Estimated reduction: ~150 lines

- [ ] **3.3 Extract ProjectFormView Component**

  - Logic: Lines 428-510 (create/edit form)
  - File: `components/tasks/project-select/project-form-view.tsx`
  - Estimated reduction: ~80 lines

- [ ] **3.4 Simplify Main Component**
  - Keep only: orchestration logic, DropdownMenu wrapper
  - Target size: ~100-150 lines
  - File: `components/tasks/project-select/index.tsx`

### Phase 4: Advanced Refactoring (Optional)

- [ ] **4.1 Implement useReducer for State Management**

  - Replace 9 useState hooks with single reducer
  - Create discriminated union for ViewMode
  - File: `hooks/use-project-select-state.ts`
  - Only if: state management becomes more complex

- [ ] **4.2 Create Project Service Layer**
  - Move business logic: validation, filtering
  - File: `lib/services/project-service.ts`
  - Only if: logic needs to be reused in API routes or other components

---

## Implementation Details

### 1.1 DeleteProjectDialog

**Props Interface:**

```typescript
interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  projectName?: string; // Optional: show project name in dialog
}
```

**Testing:**

- Verify dialog opens/closes
- Verify onConfirm callback fires
- Verify cancel button works

---

### 1.2 ProjectColorPicker

**Props Interface:**

```typescript
interface ProjectColorPickerProps {
  selectedColor: ProjectColor;
  onColorSelect: (color: ProjectColor) => void;
  variant?: "compact" | "full"; // compact for inline, full for form
}
```

**Usage Locations:**

- Inline creation (lines 373-411)
- Create/edit form (lines 462-478)

**Testing:**

- Verify color selection updates state
- Verify visual feedback (border on selected)
- Verify hover states

---

### 2.1 use-keyboard-navigation Hook

**Hook Signature:**

```typescript
/**
 * Manages keyboard navigation for dropdown menus with arrow keys.
 *
 * @param items - Array of items to navigate through
 * @param onSelect - Callback when item is selected (Enter key)
 * @param onEscape - Callback when Escape is pressed
 * @returns Highlighted index and keyboard event handler
 */
export function useKeyboardNavigation<T>(
  items: T[],
  onSelect: (item: T, index: number) => void,
  onEscape?: () => void
): {
  highlightedIndex: number;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  resetHighlight: () => void;
};
```

**Testing:**

- Arrow up/down navigation
- Enter key selection
- Escape key handling
- Edge cases (empty list, single item)

---

### 2.2 use-project-search Hook

**Hook Signature:**

```typescript
/**
 * Handles project search, filtering, and creation validation.
 *
 * @param projects - All available projects
 * @param searchQuery - Current search text
 * @returns Filtered projects and creation validation state
 */
export function useProjectSearch(
  projects: Project[],
  searchQuery: string
): {
  filteredProjects: Project[];
  exactMatch: boolean;
  canCreateNew: boolean;
};
```

**Testing:**

- Case-insensitive filtering
- Exact match detection
- Empty query handling
- Special characters in search

---

### 2.3 use-project-form Hook

**Hook Signature:**

```typescript
/**
 * Manages project form state for create/edit operations.
 *
 * @param initialProject - Optional project data for editing
 * @returns Form state and handlers
 */
export function useProjectForm(initialProject?: Project): {
  name: string;
  setName: (name: string) => void;
  color: ProjectColor;
  setColor: (color: ProjectColor) => void;
  reset: () => void;
  isValid: boolean;
};
```

**Testing:**

- Initial state (create vs edit)
- Reset functionality
- Validation (non-empty name)

---

### 3.1 ProjectMenuItem

**Props Interface:**

```typescript
interface ProjectMenuItemProps {
  project: Project;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}
```

**Testing:**

- Click to select
- Edit button shows on hover
- Delete button shows on hover
- Selected state displays check icon
- Keyboard highlight styling

---

### 3.2 ProjectListView

**Props Interface:**

```typescript
interface ProjectListViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onProjectSelect: (projectId: string) => void;
  onCreateProject: (name: string, color: ProjectColor) => void;
  onEditProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}
```

**Features:**

- Search input with auto-focus
- Filtered project list
- Inline creation with color picker
- "Create new project" button
- Empty states

---

### 3.3 ProjectFormView

**Props Interface:**

```typescript
interface ProjectFormViewProps {
  mode: "create" | "edit";
  initialData?: { name: string; color: ProjectColor };
  onSubmit: (name: string, color: ProjectColor) => void;
  onCancel: () => void;
}
```

**Features:**

- Project name input
- Color picker
- Cancel/Submit buttons
- Enter to submit
- Escape to cancel
- Auto-focus on name input

---

### 3.4 Main Component Structure

**After Refactoring:**

```typescript
// components/tasks/project-select/index.tsx
export function ProjectSelect({ value, onValueChange }: ProjectSelectProps) {
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Simplified orchestration logic only

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger>{/* ... */}</DropdownMenuTrigger>
      <DropdownMenuContent>
        {viewMode === 'list' ? (
          <ProjectListView {...listProps} />
        ) : (
          <ProjectFormView {...formProps} />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Target Metrics:**

- Main component: ~100-150 lines
- Total lines saved: ~200-250 lines through deduplication and extraction

---

## Success Criteria

### Functional Requirements

- [ ] All existing functionality works (no regressions)
- [ ] Project selection works correctly
- [ ] Create/edit/delete operations work
- [ ] Search and filtering work
- [ ] Keyboard navigation works
- [ ] Color picker works in both contexts

### Code Quality

- [ ] Main component under 150 lines
- [ ] All custom hooks have JSDoc comments
- [ ] No code duplication
- [ ] Type safety maintained (no `any` types)
- [ ] Imports follow project standards (type imports for types)

### Testing (Manual)

- [ ] Open dropdown and search for projects
- [ ] Create new project via search + color picker
- [ ] Create new project via "Create new" button
- [ ] Edit existing project
- [ ] Delete project with confirmation
- [ ] Navigate with arrow keys
- [ ] Select with Enter key
- [ ] Close with Escape key
- [ ] Clear selection with X button

---

## File Structure After Refactoring

```
components/tasks/project-select/
├── index.tsx                    # Main component (~100-150 lines)
├── project-list-view.tsx        # Search + list (~150 lines)
├── project-form-view.tsx        # Create/edit form (~80 lines)
├── project-menu-item.tsx        # Individual project row (~60 lines)
├── project-color-picker.tsx     # Color picker UI (~40 lines)
└── delete-project-dialog.tsx    # Confirmation dialog (~30 lines)

hooks/
├── use-keyboard-navigation.ts   # Keyboard nav logic (~50 lines)
├── use-project-search.ts        # Search/filter logic (~30 lines)
└── use-project-form.ts          # Form state management (~40 lines)

lib/constants/projects.ts        # PROJECT_COLORS (optional)
lib/services/project-service.ts  # Business logic (optional, Phase 4)
```

---

## Key Code References

### Current Implementation

| Feature                | Lines   | Notes                         |
| ---------------------- | ------- | ----------------------------- |
| Component definition   | 50-543  | Main component body           |
| Props & types          | 28-48   | Interfaces and constants      |
| State declarations     | 51-61   | 9 useState hooks              |
| Search filtering       | 68-78   | Can be extracted to hook      |
| Keyboard navigation    | 159-192 | Can be extracted to hook      |
| Project list rendering | 275-355 | Can be extracted to component |
| Inline color picker    | 373-411 | Duplicated in form            |
| Create/edit form       | 428-510 | Can be extracted to component |
| Form color picker      | 462-478 | Duplicated from inline        |
| Delete dialog          | 514-540 | Can be extracted to component |

### Import Dependencies to Maintain

```typescript
// UI Components
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

// Hooks & Utils
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";

// Types
import { ProjectColor } from "@/types/board.types";

// Icons
import { ChevronDownIcon, CheckIcon, XIcon } from "lucide-react";
```

---

## Notes & Considerations

### When to Stop

Following YAGNI principle:

- **Stop after Phase 1** if the component is stable and no new features are planned
- **Stop after Phase 2** if you don't need the extracted components elsewhere
- **Stop after Phase 3** if state management is working well
- **Only do Phase 4** if there's a clear, demonstrable need

### Testing Strategy

Since the project has no test framework configured:

- Rely on manual testing after each phase
- Test in isolation (Storybook) if available
- Consider adding tests after Phase 3 for critical hooks

### Migration Path

Each phase is deployable independently:

1. Create new files alongside existing component
2. Test new implementation thoroughly
3. Switch imports in one commit
4. Delete old code in next commit

This allows easy rollback if issues arise.

---

## Commit Message Templates

**After Phase 1:**

```
refactor(project-select): extract delete dialog and color picker components

- Extract DeleteProjectDialog to separate component
- Extract ProjectColorPicker to deduplicate color selection UI
- Reduce main component by ~70 lines
- No functional changes
```

**After Phase 2:**

```
refactor(project-select): extract keyboard navigation and search hooks

- Create use-keyboard-navigation hook for arrow key handling
- Create use-project-search hook for filtering and validation
- Create use-project-form hook for form state management
- Add JSDoc documentation to all hooks
- Reduce main component by ~65 lines
```

**After Phase 3:**

```
refactor(project-select): break down into focused sub-components

- Extract ProjectMenuItem for individual project rows
- Extract ProjectListView for search and list rendering
- Extract ProjectFormView for create/edit functionality
- Simplify main component to orchestration logic only
- Reduce total codebase by ~200 lines through deduplication
- All existing functionality preserved
```

---

## References

- Original file: `components/tasks/project-select.tsx` (544 lines)
- Project guidelines: `CLAUDE.md` (KISS, YAGNI principles)
- React Hook Best Practices: `CLAUDE.md` (JSDoc requirements)
- Component patterns: shadcn/ui compound components

---

**Last Updated:** 2025-10-28
**Status:** Planning
**Next Action:** Begin Phase 1 - Extract DeleteProjectDialog
