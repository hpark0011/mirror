import type { GreyboardSnapshotV2, SnapshotSource } from "@feel-good/utils/greyboard-snapshot";

export interface WorkspaceStorageAdapter {
  loadSnapshot: () => Promise<GreyboardSnapshotV2>;
  saveSnapshot: (snapshot: GreyboardSnapshotV2) => Promise<GreyboardSnapshotV2>;
  importSnapshot: (json: string) => Promise<GreyboardSnapshotV2>;
  exportSnapshot: () => Promise<string>;
}

export interface WorkspaceStorageOptions {
  source: SnapshotSource;
}
