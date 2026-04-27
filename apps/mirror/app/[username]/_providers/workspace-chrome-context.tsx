"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type WorkspaceChromeContextValue = {
  contentPanelId: string;
  isContentPanelCollapsed: boolean;
  toggleContentPanel: () => void;
  interactionPanelId: string;
  isInteractionPanelCollapsed: boolean;
  toggleInteractionPanel: () => void;
  showContentPanelToggle: boolean;
  backHref?: string;
};

const WorkspaceChromeContext = createContext<WorkspaceChromeContextValue | null>(
  null,
);

export function useOptionalWorkspaceChrome() {
  return useContext(WorkspaceChromeContext);
}

export function useWorkspaceChrome() {
  const ctx = useOptionalWorkspaceChrome();
  if (!ctx) {
    throw new Error(
      "useWorkspaceChrome must be used within WorkspaceChromeProvider",
    );
  }
  return ctx;
}

type WorkspaceChromeProviderProps = {
  value: WorkspaceChromeContextValue;
  children: ReactNode;
};

export function WorkspaceChromeProvider({
  value,
  children,
}: WorkspaceChromeProviderProps) {
  return (
    <WorkspaceChromeContext.Provider value={value}>
      {children}
    </WorkspaceChromeContext.Provider>
  );
}

