import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from './lib/channels'
import { type DesktopAPI } from './lib/desktop-api'

contextBridge.exposeInMainWorld('greyboardDesktop', {
  app: {
    getVersion: () => ipcRenderer.invoke(CHANNELS.APP_GET_VERSION),
    getPlatform: () => ipcRenderer.invoke(CHANNELS.APP_GET_PLATFORM),
  },
  docs: {
    selectFolder: () => ipcRenderer.invoke(CHANNELS.DOCS_SELECT_FOLDER),
    getFolder: () => ipcRenderer.invoke(CHANNELS.DOCS_GET_FOLDER),
    listFiles: () => ipcRenderer.invoke(CHANNELS.DOCS_LIST_FILES),
    readFile: (name: string) =>
      ipcRenderer.invoke(CHANNELS.DOCS_READ_FILE, { name }),
  },
  notifications: {
    show: (title: string, body: string) =>
      ipcRenderer.invoke(CHANNELS.NOTIFICATIONS_SHOW, { title, body }),
  },
  updates: {
    check: () => ipcRenderer.invoke(CHANNELS.UPDATES_CHECK),
    onStatus: (callback: (status: string, info?: unknown) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        status: string,
        info?: unknown
      ) => {
        callback(status, info)
      }
      ipcRenderer.on(CHANNELS.UPDATES_ON_STATUS, listener)
      return () => {
        ipcRenderer.removeListener(CHANNELS.UPDATES_ON_STATUS, listener)
      }
    },
  },
} satisfies DesktopAPI)
