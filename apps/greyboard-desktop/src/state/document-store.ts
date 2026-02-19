import { create } from 'zustand'
import { type DocumentFile } from '@/electron/lib/desktop-api'
import { desktopAPI } from '@/src/lib/ipc/client'

interface DocumentState {
  folderPath: string | null
  files: DocumentFile[]
  isLoading: boolean
  error: string | null
}

interface DocumentActions {
  selectFolder: () => Promise<void>
  loadFolder: () => Promise<void>
}

export const useDocumentStore = create<DocumentState & DocumentActions>()(
  (set, get) => ({
    folderPath: null,
    files: [],
    isLoading: false,
    error: null,

    loadFolder: async () => {
      const hadFolder = get().folderPath !== null
      set({ isLoading: true, error: null })
      try {
        const folder = await desktopAPI.docs.getFolder()
        if (!folder) {
          set({
            folderPath: null,
            files: [],
            isLoading: false,
            ...(hadFolder ? { error: 'The selected folder no longer exists.' } : {}),
          })
          return
        }

        set({ folderPath: folder.path })
        const files = await desktopAPI.docs.listFiles()
        set({ files, isLoading: false })
      } catch {
        set({ isLoading: false, error: 'Failed to load folder' })
      }
    },

    selectFolder: async () => {
      try {
        const result = await desktopAPI.docs.selectFolder()
        if (!result) return // User canceled

        set({ folderPath: result.path, isLoading: true, error: null })
        const files = await desktopAPI.docs.listFiles()
        set({ files, isLoading: false })
      } catch {
        set({ isLoading: false, error: 'Failed to select folder' })
      }
    },
  })
)
