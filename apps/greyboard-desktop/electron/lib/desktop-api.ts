import { type GreyboardSnapshotV2 } from '@feel-good/utils/greyboard-snapshot'

export interface DesktopAPI {
  platform: NodeJS.Platform
  app: {
    getVersion: () => Promise<string>
    getPlatform: () => Promise<string>
  }
  state: {
    load: () => Promise<GreyboardSnapshotV2>
    save: (snapshot: GreyboardSnapshotV2) => Promise<GreyboardSnapshotV2>
    importSnapshot: (json: string) => Promise<GreyboardSnapshotV2>
    exportSnapshot: () => Promise<string>
  }
  notifications: {
    show: (title: string, body: string) => Promise<void>
  }
  updates: {
    check: () => Promise<{ status: string }>
    onStatus: (
      callback: (status: string, info?: unknown) => void
    ) => () => void
  }
}
