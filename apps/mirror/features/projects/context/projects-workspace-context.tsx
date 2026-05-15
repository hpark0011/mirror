"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { type Preloaded } from "convex/react";
import { type api } from "@feel-good/convex/convex/_generated/api";

type PreloadedProjects = Preloaded<typeof api.projects.queries.getByUsername>;

type ProjectsWorkspaceContextValue = {
  preloadedProjects: PreloadedProjects;
  username: string;
};

const ProjectsWorkspaceContext =
  createContext<ProjectsWorkspaceContextValue | null>(null);

type ProjectsWorkspaceProviderProps = {
  preloadedProjects: PreloadedProjects;
  username: string;
  children: ReactNode;
};

export function ProjectsWorkspaceProvider({
  preloadedProjects,
  username,
  children,
}: ProjectsWorkspaceProviderProps) {
  const value = useMemo(
    () => ({ preloadedProjects, username }),
    [preloadedProjects, username],
  );
  return (
    <ProjectsWorkspaceContext.Provider value={value}>
      {children}
    </ProjectsWorkspaceContext.Provider>
  );
}

export function useProjectsWorkspace(): ProjectsWorkspaceContextValue {
  const ctx = useContext(ProjectsWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useProjectsWorkspace must be used within a ProjectsWorkspaceProvider",
    );
  }
  return ctx;
}
