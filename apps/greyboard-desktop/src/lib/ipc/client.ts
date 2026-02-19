import {
  type DesktopAPI,
  type DocumentFile,
} from '@/electron/lib/desktop-api'

function getDesktopAPI(): DesktopAPI | null {
  if (typeof window !== 'undefined' && window.greyboardDesktop) {
    return window.greyboardDesktop
  }
  return null
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
  docs: {
    selectFolder: async (): Promise<{ path: string } | null> => {
      const api = getDesktopAPI()
      return api?.docs.selectFolder() ?? null
    },
    getFolder: async (): Promise<{ path: string } | null> => {
      const api = getDesktopAPI()
      return api?.docs.getFolder() ?? null
    },
    listFiles: async (): Promise<DocumentFile[]> => {
      const api = getDesktopAPI()
      return api?.docs.listFiles() ?? []
    },
    readFile: async (
      name: string
    ): Promise<{ name: string; content: string } | null> => {
      const api = getDesktopAPI()
      return api?.docs.readFile(name) ?? null
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
