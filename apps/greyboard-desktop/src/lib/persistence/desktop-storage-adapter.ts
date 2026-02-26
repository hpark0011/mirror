import type { WorkspaceStorageAdapter } from "@feel-good/greyboard-core/persistence";
import { type GreyboardSnapshotV2 } from "@feel-good/utils/greyboard-snapshot";
import { desktopAPI } from "@/src/lib/ipc/client";

export const desktopStorageAdapter: WorkspaceStorageAdapter = {
  async loadSnapshot(): Promise<GreyboardSnapshotV2> {
    return desktopAPI.state.load();
  },

  async saveSnapshot(snapshot: GreyboardSnapshotV2): Promise<GreyboardSnapshotV2> {
    return desktopAPI.state.save(snapshot);
  },

  async importSnapshot(json: string): Promise<GreyboardSnapshotV2> {
    return desktopAPI.state.importSnapshot(json);
  },

  async exportSnapshot(): Promise<string> {
    return desktopAPI.state.exportSnapshot();
  },
};

export default desktopStorageAdapter;
