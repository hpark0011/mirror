"use client";

import { TaskWorkspace } from "@feel-good/greyboard-core/workspace";
import { webStorageAdapter } from "@/lib/persistence/web-storage-adapter";

export function TasksView() {
  return <TaskWorkspace storage={webStorageAdapter} source="web" />;
}
