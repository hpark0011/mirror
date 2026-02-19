export interface DocumentFile {
  name: string
  lastModified: string
  sizeBytes: number
}

export interface DesktopAPI {
  app: {
    getVersion: () => Promise<string>
    getPlatform: () => Promise<string>
  }
  docs: {
    selectFolder: () => Promise<{ path: string } | null>
    getFolder: () => Promise<{ path: string } | null>
    listFiles: () => Promise<DocumentFile[]>
    readFile: (name: string) => Promise<{ name: string; content: string } | null>
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
