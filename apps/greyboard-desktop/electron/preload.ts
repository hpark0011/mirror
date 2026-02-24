import { contextBridge, ipcRenderer } from 'electron'
import { type GreyboardSnapshotV2 } from '@feel-good/utils/greyboard-snapshot'
import { CHANNELS } from './lib/channels'
import { type DesktopAPI } from './lib/desktop-api'

contextBridge.exposeInMainWorld('greyboardDesktop', {
  platform: process.platform,
  app: {
    getVersion: () => ipcRenderer.invoke(CHANNELS.APP_GET_VERSION),
    getPlatform: () => ipcRenderer.invoke(CHANNELS.APP_GET_PLATFORM),
  },
  state: {
    load: () => ipcRenderer.invoke(CHANNELS.STATE_LOAD),
    save: (snapshot: GreyboardSnapshotV2) =>
      ipcRenderer.invoke(CHANNELS.STATE_SAVE, { snapshot }),
    importSnapshot: (json: string) =>
      ipcRenderer.invoke(CHANNELS.STATE_IMPORT, { json }),
    exportSnapshot: () => ipcRenderer.invoke(CHANNELS.STATE_EXPORT),
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
