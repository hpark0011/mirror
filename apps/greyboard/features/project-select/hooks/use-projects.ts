"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";
import type { Project, ProjectColor } from "@feel-good/greyboard-core/types";

const STORAGE_KEY = getStorageKey("TASKS", "PROJECTS");
const MAX_PROJECT_NAME_LENGTH = 50;

export interface UseProjectsReturn {
  projects: Project[];
  addProject: (name: string, color: ProjectColor) => Project;
  updateProject: (id: string, updates: Partial<Omit<Project, "id">>) => void;
  deleteProject: (id: string) => void;
  getProjectById: (id: string) => Project | undefined;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useLocalStorage<Project[]>(STORAGE_KEY, []);

  const addProject = useCallback(
    (name: string, color: ProjectColor): Project => {
      // Validate project name
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error("Project name cannot be empty");
      }
      if (trimmedName.length > MAX_PROJECT_NAME_LENGTH) {
        throw new Error(
          `Project name cannot exceed ${MAX_PROJECT_NAME_LENGTH} characters`
        );
      }

      // Generate unique ID
      const newProject: Project = {
        id: `project-${Date.now()}`,
        name: trimmedName,
        color,
      };

      setProjects((prev) => [...prev, newProject]);
      return newProject;
    },
    [setProjects]
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<Omit<Project, "id">>) => {
      // Validate name if provided
      if (updates.name !== undefined) {
        const trimmedName = updates.name.trim();
        if (!trimmedName) {
          throw new Error("Project name cannot be empty");
        }
        if (trimmedName.length > MAX_PROJECT_NAME_LENGTH) {
          throw new Error(
            `Project name cannot exceed ${MAX_PROJECT_NAME_LENGTH} characters`
          );
        }
        updates.name = trimmedName;
      }

      setProjects((prev) =>
        prev.map((project) =>
          project.id === id ? { ...project, ...updates } : project
        )
      );
    },
    [setProjects]
  );

  const deleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((project) => project.id !== id));
    },
    [setProjects]
  );

  const getProjectById = useCallback(
    (id: string): Project | undefined => {
      return projects.find((project) => project.id === id);
    },
    [projects]
  );

  return {
    projects,
    addProject,
    updateProject,
    deleteProject,
    getProjectById,
  };
}
