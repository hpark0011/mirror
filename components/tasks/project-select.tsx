"use client";

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
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { ProjectColor } from "@/types/board.types";
import { ChevronDownIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

interface ProjectSelectProps {
  value?: string;
  onValueChange: (projectId: string | undefined) => void;
}

const PROJECT_COLORS: {
  color: ProjectColor;
  bgClass: string;
  displayClass: string;
}[] = [
  { color: "gray", bgClass: "bg-neutral-500", displayClass: "bg-neutral-500" },
  { color: "red", bgClass: "bg-red-500", displayClass: "bg-red-500" },
  { color: "orange", bgClass: "bg-orange-500", displayClass: "bg-orange-500" },
  { color: "yellow", bgClass: "bg-yellow-500", displayClass: "bg-yellow-500" },
  { color: "green", bgClass: "bg-green-500", displayClass: "bg-green-500" },
  { color: "blue", bgClass: "bg-blue-500", displayClass: "bg-blue-500" },
  { color: "purple", bgClass: "bg-purple-500", displayClass: "bg-purple-500" },
  { color: "pink", bgClass: "bg-pink-500", displayClass: "bg-pink-500" },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const selectedProject = value ? getProjectById(value) : undefined;

  // Filter projects based on search query
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if search query exactly matches an existing project
  const exactMatch = filteredProjects.some(
    (p) => p.name.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  // Can create new project if search has text and no exact match
  const canCreateNew = searchQuery.trim() && !exactMatch;

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

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
      setSearchQuery("");
      setHighlightedIndex(-1);
      setShowColorPicker(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredProjects.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        // Select highlighted project
        const selectedProject = filteredProjects[highlightedIndex];
        onValueChange(selectedProject.id);
        setOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      } else if (canCreateNew) {
        // Toggle color picker for creation
        setShowColorPicker((prev) => !prev);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (showColorPicker) {
        setShowColorPicker(false);
      } else if (searchQuery) {
        setSearchQuery("");
        setHighlightedIndex(-1);
      } else {
        setOpen(false);
      }
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger
          className={cn(
            "focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-md bg-transparent px-1.5 py-0 text-[13px] transition-[color,box-shadow] outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-hover relative cursor-pointer",
            !selectedProject && "text-text-muted"
          )}
        >
          <div className='flex items-center gap-1.5 flex-1 min-w-0 text-[13px]'>
            {selectedProject ? (
              <>
                <span
                  className={cn(
                    "size-1.5 rounded-full flex-shrink-0",
                    PROJECT_COLORS.find(
                      (c) => c.color === selectedProject.color
                    )?.bgClass
                  )}
                />
                <span className='truncate'>{selectedProject.name}</span>
              </>
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
              <DropdownMenuSeparator />
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project, index) => (
                  <DropdownMenuItem
                    key={project.id}
                    className={cn(
                      "group flex items-center justify-between gap-2 pl-1 pr-0.5 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                      highlightedIndex === index &&
                        "bg-accent text-accent-foreground"
                    )}
                    onSelect={(e) => {
                      e.preventDefault();
                      onValueChange(
                        value === project.id ? undefined : project.id
                      );
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseLeave={() => setHighlightedIndex(-1)}
                  >
                    <div className='flex flex-1 min-w-0 items-center gap-1.5 px-1'>
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          PROJECT_COLORS.find((c) => c.color === project.color)
                            ?.bgClass
                        )}
                      />
                      <span className='truncate'>{project.name}</span>
                    </div>
                    <div
                      className={cn(
                        "flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-data-[highlighted]:opacity-100",
                        highlightedIndex === index && "opacity-100"
                      )}
                    >
                      <Button
                        size='sm'
                        variant='icon'
                        className='h-6 w-6 p-0'
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(project.id);
                        }}
                        aria-label='Edit project'
                      >
                        <Icon
                          name='PencilIcon'
                          className='size-4 text-icon-light'
                        />
                      </Button>
                      <Button
                        size='sm'
                        variant='icon'
                        className='h-6 w-6 p-0 text-destructive hover:text-destructive'
                        onClick={(e) => {
                          e.stopPropagation();
                          startDelete(project.id);
                        }}
                        aria-label='Delete project'
                      >
                        <Icon
                          name='TrashFillIcon'
                          className='size-4 text-icon-light'
                        />
                      </Button>
                    </div>
                  </DropdownMenuItem>
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

              {value && (
                <DropdownMenuItem
                  onSelect={() => {
                    onValueChange(undefined);
                  }}
                >
                  Clear Selection
                </DropdownMenuItem>
              )}

              {canCreateNew ? (
                <>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowColorPicker((prev) => !prev);
                    }}
                  >
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
                                setSearchQuery("");
                                setShowColorPicker(false);
                                setHighlightedIndex(-1);
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
                    setSearchQuery("");
                    setHighlightedIndex(-1);
                  }}
                >
                  Create new project
                </DropdownMenuItem>
              )}
            </>
          ) : (
            <div className='p-2 space-y-3'>
              <div className='space-y-2'>
                <label className='text-xs font-medium text-foreground'>
                  Project Name
                </label>
                <Input
                  placeholder='Enter project name...'
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (viewMode === "create") {
                        handleCreate();
                      } else if (
                        typeof viewMode === "object" &&
                        viewMode.mode === "edit"
                      ) {
                        handleUpdate(viewMode.projectId);
                      }
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelForm();
                    }
                  }}
                  autoFocus
                  className='h-8'
                />
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-medium text-foreground'>
                  Color
                </label>
                <div className='flex gap-2 flex-wrap'>
                  {PROJECT_COLORS.map(({ color, bgClass }) => (
                    <button
                      key={color}
                      type='button'
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "size-6 rounded-full transition-all border-2",
                        selectedColor === color
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105",
                        bgClass
                      )}
                      aria-label={`Select ${color} color`}
                    />
                  ))}
                </div>
              </div>

              <div className='flex gap-2 pt-2'>
                <Button
                  size='sm'
                  variant='outline'
                  className='flex-1 h-8'
                  onClick={cancelForm}
                >
                  Cancel
                </Button>
                <Button
                  size='sm'
                  variant='primary'
                  className='flex-1 h-8'
                  onClick={() => {
                    if (viewMode === "create") {
                      handleCreate();
                    } else if (
                      typeof viewMode === "object" &&
                      viewMode.mode === "edit"
                    ) {
                      handleUpdate(viewMode.projectId);
                    }
                  }}
                  disabled={!projectName.trim()}
                >
                  {viewMode === "create" ? "Create" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className='text-sm text-muted-foreground'>
              Are you sure you want to delete this project? This action cannot
              be undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setDeleteDialogOpen(false);
                setProjectToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
