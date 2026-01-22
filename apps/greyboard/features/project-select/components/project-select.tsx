"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PROJECT_COLORS } from "@/config/tasks.config";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { cn } from "@/lib/utils";
import type { ProjectColor } from "@/types/board.types";
import { useProjectSelection } from "../hooks/use-project-selection";
import { useProjects } from "../hooks/use-projects";
import { useSearchState } from "../hooks/use-search-state";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { ProjectColorIndicator } from "./project-color-indicator";
import { ProjectCreateEditForm } from "./project-create-edit-form";
import { ProjectMenuItem } from "./project-menu-item";

interface ProjectSelectProps {
  value?: string;
  onValueChange: (projectId: string | undefined) => void;
}

type ViewMode = "list" | "create" | { mode: "edit"; projectId: string };

export function ProjectSelect({ value, onValueChange }: ProjectSelectProps) {
  const { projects, addProject, updateProject, deleteProject, getProjectById } =
    useProjects();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [projectName, setProjectName] = useState("");
  const [selectedColor, setSelectedColor] = useState<ProjectColor>("blue");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Use extracted hooks for search state management
  const {
    searchQuery,
    setSearchQuery,
    highlightedIndex,
    updateHighlightedIndex,
    showColorPicker,
    toggleColorPicker,
    resetSearch,
  } = useSearchState();

  const selectedProject = value ? getProjectById(value) : undefined;

  // Use project selection hook
  const { selectProject, handleEscape } = useProjectSelection({
    onValueChange,
    setOpen,
    resetSearch,
  });

  // Filtered projects and derived state with useMemo for performance
  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [projects, searchQuery]
  );

  const canCreateNew = useMemo(
    () =>
      Boolean(searchQuery.trim()) &&
      !filteredProjects.some(
        (p) => p.name.toLowerCase() === searchQuery.trim().toLowerCase()
      ),
    [searchQuery, filteredProjects]
  );

  // Keyboard navigation hook
  const { handleKeyDown: handleNavigationKeyDown } = useKeyboardNavigation({
    items: filteredProjects,
    highlightedIndex,
    onHighlightChange: updateHighlightedIndex,
    onSelect: selectProject,
    canCreateNew,
    onToggleColorPicker: toggleColorPicker,
  });

  // Reset highlighted index when search changes
  useEffect(() => {
    updateHighlightedIndex(-1);
  }, [searchQuery, updateHighlightedIndex]);

  const handleCreate = () => {
    if (!projectName.trim()) return;

    try {
      const newProject = addProject(projectName, selectedColor);
      onValueChange(newProject.id);
      setProjectName("");
      setSelectedColor("blue");
      setViewMode("list");
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const handleUpdate = (projectId: string) => {
    if (!projectName.trim()) return;

    try {
      updateProject(projectId, {
        name: projectName,
        color: selectedColor,
      });
      setProjectName("");
      setSelectedColor("blue");
      setViewMode("list");
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  };

  const handleDelete = () => {
    if (!projectToDelete) return;

    deleteProject(projectToDelete);
    if (value === projectToDelete) {
      onValueChange(undefined);
    }
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const startEdit = (projectId: string) => {
    const project = getProjectById(projectId);
    if (project) {
      setProjectName(project.name);
      setSelectedColor(project.color);
      setViewMode({ mode: "edit", projectId });
    }
  };

  const startDelete = (projectId: string) => {
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  const cancelForm = () => {
    setProjectName("");
    setSelectedColor("blue");
    setViewMode("list");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setViewMode("list");
      setProjectName("");
      setSelectedColor("blue");
      resetSearch();
    }
  };

  // Main keyboard handler with cleaner logic
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const result = handleNavigationKeyDown(e);

      if (result === "escape") {
        const action = handleEscape(showColorPicker, searchQuery);

        switch (action) {
          case "close-color-picker":
            toggleColorPicker();
            break;
          case "clear-search":
            setSearchQuery("");
            updateHighlightedIndex(-1);
            break;
          case "close-dropdown":
            setOpen(false);
            break;
        }
      }
    },
    [
      handleNavigationKeyDown,
      handleEscape,
      showColorPicker,
      searchQuery,
      toggleColorPicker,
      setSearchQuery,
      updateHighlightedIndex,
      setOpen,
    ]
  );

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger
          className={cn(
            "focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-md bg-transparent px-1.5 pl-2 py-0 text-[13px] transition-[color,box-shadow] outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-hover relative cursor-pointer",
            !selectedProject && "text-text-muted"
          )}
        >
          <div className='flex items-center gap-1.5 flex-1 min-w-0 text-[13px]'>
            {selectedProject ? (
              <ProjectColorIndicator
                color={selectedProject.color}
                name={selectedProject.name}
                className='flex-1 min-w-0'
              />
            ) : (
              <>
                <Icon
                  name='FolderFillIcon'
                  className='size-4 text-icon-light'
                />{" "}
                <span className='text-text-muted'>Project</span>
              </>
            )}
          </div>
          <ChevronDownIcon className='size-4 text-icon-light' />
        </DropdownMenuTrigger>

        <DropdownMenuContent className='min-w-[280px]' align='start'>
          {viewMode === "list" ? (
            <>
              {selectedProject ? (
                <div className='flex items-center px-0.5 h-7'>
                  <Badge>
                    <ProjectColorIndicator
                      color={selectedProject.color}
                      name={selectedProject.name}
                      className='ml-0.5'
                    />
                    <button
                      type='button'
                      onClick={() => {
                        onValueChange("");
                      }}
                      className='flex items-center justify-center transition-colors [&_svg]:hover:text-blue-500 [&_svg]:text-icon-light ml-0.5'
                      aria-label='Clear project selection'
                    >
                      <XIcon className='size-3' />
                    </button>
                  </Badge>
                </div>
              ) : (
                <Input
                  placeholder='Search projects...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    // Prevent DropdownMenu typeahead from intercepting keystrokes
                    e.stopPropagation();

                    // Handle our custom keyboard navigation
                    handleSearchKeyDown(e);
                  }}
                  className='h-7 border-none p-2'
                  autoFocus={false}
                />
              )}
              <DropdownMenuSeparator />
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project, index) => (
                  <ProjectMenuItem
                    key={project.id}
                    project={project}
                    isSelected={value === project.id}
                    isKeyboardHighlighted={highlightedIndex === index}
                    onSelect={(projectId) => {
                      onValueChange(
                        value === projectId ? undefined : projectId
                      );
                    }}
                    onEdit={startEdit}
                    onDelete={startDelete}
                  />
                ))
              ) : searchQuery ? (
                <div className='px-2 py-6 text-center text-sm text-muted-foreground'>
                  No projects found
                </div>
              ) : (
                <div className='px-2 py-6 text-center text-sm text-muted-foreground'>
                  No projects yet
                </div>
              )}

              <DropdownMenuSeparator />

              {canCreateNew ? (
                <>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      toggleColorPicker();
                    }}
                  >
                    <Icon
                      name='PlusIcon'
                      className='size-4.5 text-icon-light'
                    />
                    Create &apos;{searchQuery.trim()}&apos;
                  </DropdownMenuItem>
                  {showColorPicker && (
                    <div className='px-2 py-2 space-y-2'>
                      <div className='text-xs font-medium text-foreground px-1'>
                        Choose color
                      </div>
                      <div className='flex gap-2 flex-wrap px-1'>
                        {PROJECT_COLORS.map(({ color, bgClass }) => (
                          <button
                            key={color}
                            type='button'
                            onClick={() => {
                              try {
                                const newProject = addProject(
                                  searchQuery.trim(),
                                  color
                                );
                                onValueChange(newProject.id);
                                resetSearch();
                                setOpen(false);
                              } catch (error) {
                                console.error(
                                  "Failed to create project:",
                                  error
                                );
                              }
                            }}
                            className={cn(
                              "size-6 rounded-full transition-all border-2 hover:scale-110",
                              "border-transparent hover:border-foreground/20",
                              bgClass
                            )}
                            aria-label={`Create project with ${color} color`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setViewMode("create");
                    resetSearch();
                  }}
                >
                  <Icon name='PlusIcon' className='size-4.5 text-icon-light' />
                  Create new project
                </DropdownMenuItem>
              )}
            </>
          ) : (
            <ProjectCreateEditForm
              viewMode={viewMode}
              projectName={projectName}
              selectedColor={selectedColor}
              onProjectNameChange={setProjectName}
              onColorChange={setSelectedColor}
              onCancel={cancelForm}
              onSubmit={() => {
                if (viewMode === "create") {
                  handleCreate();
                } else if (
                  typeof viewMode === "object" &&
                  viewMode.mode === "edit"
                ) {
                  handleUpdate(viewMode.projectId);
                }
              }}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setProjectToDelete(null); // Cleanup when closing
          }
        }}
        onConfirm={handleDelete}
        projectName={
          projectToDelete ? getProjectById(projectToDelete)?.name : undefined
        }
      />
    </>
  );
}
