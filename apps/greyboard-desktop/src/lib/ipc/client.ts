import {
  createEmptySnapshot,
  deserializeSnapshot,
  serializeSnapshot,
  type GreyboardSnapshotV2,
} from '@feel-good/utils/greyboard-snapshot'
import { type DesktopAPI } from '@/electron/lib/desktop-api'

function getDesktopAPI(): DesktopAPI | null {
  if (typeof window !== 'undefined' && window.greyboardDesktop) {
    return window.greyboardDesktop
  }
  return null
}

function getDefaultSnapshot(): GreyboardSnapshotV2 {
  return createEmptySnapshot('desktop')
}

export const desktopAPI = {
  app: {
    getVersion: async () => {
      const api = getDesktopAPI()
      return api?.app.getVersion() ?? 'unknown'
    },
    getPlatform: async () => {
      const api = getDesktopAPI()
      return api?.app.getPlatform() ?? 'unknown'
    },
  },
  state: {
    load: async (): Promise<GreyboardSnapshotV2> => {
      const api = getDesktopAPI()
      return api?.state.load() ?? getDefaultSnapshot()
    },
    save: async (snapshot: GreyboardSnapshotV2): Promise<GreyboardSnapshotV2> => {
      const api = getDesktopAPI()
      return api?.state.save(snapshot) ?? snapshot
    },
    importSnapshot: async (json: string): Promise<GreyboardSnapshotV2> => {
      const api = getDesktopAPI()
      if (api) {
        return api.state.importSnapshot(json)
      }
      return deserializeSnapshot(json)
    },
    exportSnapshot: async (): Promise<string> => {
      const api = getDesktopAPI()
      if (api) {
        return api.state.exportSnapshot()
      }
      return serializeSnapshot(getDefaultSnapshot())
    },
  },
  notifications: {
    show: async (title: string, body: string) => {
      const api = getDesktopAPI()
      await api?.notifications.show(title, body)
    },
  },
  updates: {
    check: async () => {
      const api = getDesktopAPI()
      return api?.updates.check() ?? { status: 'error' }
    },
    onStatus: (callback: (status: string, info?: unknown) => void) => {
      const api = getDesktopAPI()
      return api?.updates.onStatus(callback) ?? (() => {})
    },
  },
}
