"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/use-projects";
import { ProjectColor } from "@/types/board.types";
import { ChevronDownIcon, PencilIcon, TrashIcon } from "lucide-react";

interface ProjectSelectProps {
  value?: string;
  onValueChange: (projectId: string | undefined) => void;
  className?: string;
}

const PROJECT_COLORS: { color: ProjectColor; class: string }[] = [
  { color: "gray", class: "text-neutral-500" },
  { color: "red", class: "text-red-500" },
  { color: "orange", class: "text-orange-500" },
  { color: "yellow", class: "text-yellow-500" },
  { color: "green", class: "text-green-500" },
  { color: "blue", class: "text-blue-500" },
  { color: "purple", class: "text-purple-500" },
  { color: "pink", class: "text-pink-500" },
];

type ViewMode = "list" | "create" | { mode: "edit"; projectId: string };

export function ProjectSelect({
  value,
  onValueChange,
  className,
}: ProjectSelectProps) {
  const { projects, addProject, updateProject, deleteProject, getProjectById } =
    useProjects();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [projectName, setProjectName] = useState("");
  const [selectedColor, setSelectedColor] = useState<ProjectColor>("blue");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const selectedProject = value ? getProjectById(value) : undefined;

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
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between h-9 px-3 text-sm border-border",
              className
            )}
          >
            <div className="flex items-center gap-2">
              {selectedProject ? (
                <>
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      PROJECT_COLORS.find((c) => c.color === selectedProject.color)
                        ?.class
                    )}
                  />
                  <span>{selectedProject.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No project</span>
              )}
            </div>
            <ChevronDownIcon className="size-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="min-w-[280px]" align="start">
          {viewMode === "list" ? (
            <>
              {projects.length > 0 ? (
                projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    className="flex items-center justify-between gap-2 pr-1"
                    onSelect={(e) => {
                      e.preventDefault();
                      onValueChange(
                        value === project.id ? undefined : project.id
                      );
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className={cn(
                          "size-2 rounded-full flex-shrink-0",
                          PROJECT_COLORS.find((c) => c.color === project.color)
                            ?.class
                        )}
                      />
                      <span className="truncate">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(project.id);
                        }}
                        aria-label="Edit project"
                      >
                        <PencilIcon className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          startDelete(project.id);
                        }}
                        aria-label="Delete project"
                      >
                        <TrashIcon className="size-3" />
                      </Button>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
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

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setViewMode("create");
                }}
              >
                Create New Project
              </DropdownMenuItem>
            </>
          ) : (
            <div className="p-2 space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  Project Name
                </label>
                <Input
                  placeholder="Enter project name..."
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
                  className="h-8"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map(({ color, class: colorClass }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "size-6 rounded-full transition-all border-2",
                        selectedColor === color
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105",
                        colorClass
                      )}
                      style={{ backgroundColor: "currentColor" }}
                      aria-label={`Select ${color} color`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8"
                  onClick={cancelForm}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1 h-8"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this project? This action cannot be
              undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setProjectToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
