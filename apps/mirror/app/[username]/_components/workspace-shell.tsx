"use client";

import { type ReactNode } from "react";
import { useSelectedLayoutSegments } from "next/navigation";
import { getContentRouteState } from "@/features/content";
import { ContentPanel } from "./content-panel";

type WorkspaceShellProps = {
  content: ReactNode;
};

export function WorkspaceShell({ content }: WorkspaceShellProps) {
  const segments = useSelectedLayoutSegments();
  const routeState = getContentRouteState(segments);

  return (
    <main className="relative h-screen">
      <ContentPanel routeState={routeState}>{content}</ContentPanel>
    </main>
  );
}
