import { type BrowserWindow, app, dialog, ipcMain } from 'electron'
import { lstat, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CHANNELS } from '../lib/channels'
import { type DocumentFile } from '../lib/desktop-api'
import { readFilePayloadSchema } from '../lib/validators'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

let selectedFolderPath: string | null = null

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'docs-settings.json')
}

async function loadPersistedFolder(): Promise<string | null> {
  try {
    const content = await readFile(getSettingsPath(), 'utf-8')
    const data = JSON.parse(content)
    if (typeof data.folderPath === 'string') {
      // Verify the folder still exists
      const info = await stat(data.folderPath)
      if (info.isDirectory()) {
        return data.folderPath
      }
    }
  } catch {
    // File doesn't exist or is invalid — that's fine
  }
  return null
}

async function persistFolder(folderPath: string | null): Promise<void> {
  try {
    await writeFile(
      getSettingsPath(),
      JSON.stringify({ folderPath }),
      'utf-8'
    )
  } catch {
    console.warn('Failed to persist folder path')
  }
}

export async function registerDocHandlers(mainWindow: BrowserWindow) {
  // Load persisted folder before registering handlers
  selectedFolderPath = await loadPersistedFolder()

  ipcMain.handle(CHANNELS.DOCS_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Document Folder',
      properties: ['openDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const folderPath = result.filePaths[0]
    if (!folderPath) return null

    selectedFolderPath = folderPath
    await persistFolder(folderPath)

    return { path: folderPath }
  })

  ipcMain.handle(CHANNELS.DOCS_GET_FOLDER, async () => {
    const folder = selectedFolderPath
    if (!folder) return null

    // Verify the folder still exists
    try {
      const info = await stat(folder)
      if (!info.isDirectory()) {
        selectedFolderPath = null
        await persistFolder(null)
        return null
      }
    } catch {
      selectedFolderPath = null
      await persistFolder(null)
      return null
    }

    return { path: folder }
  })

  ipcMain.handle(CHANNELS.DOCS_LIST_FILES, async () => {
    const folder = selectedFolderPath
    if (!folder) return []

    try {
      const entries = await readdir(folder, { withFileTypes: true })

      const mdEntries = entries.filter(
        (entry) =>
          entry.isFile() &&
          !entry.isSymbolicLink() &&
          !entry.name.startsWith('.') &&
          entry.name.endsWith('.md')
      )

      const STAT_CONCURRENCY = 20
      const files: DocumentFile[] = []

      for (let i = 0; i < mdEntries.length; i += STAT_CONCURRENCY) {
        const batch = mdEntries.slice(i, i + STAT_CONCURRENCY)
        const results = await Promise.allSettled(
          batch.map(async (entry) => {
            const filePath = path.join(folder, entry.name)
            const fileInfo = await stat(filePath)
            return {
              name: entry.name,
              lastModified: fileInfo.mtime.toISOString(),
              sizeBytes: fileInfo.size,
            }
          })
        )
        for (const result of results) {
          if (result.status === 'fulfilled') {
            files.push(result.value)
          }
        }
      }

      return files
    } catch {
      return []
    }
  })

  ipcMain.handle(
    CHANNELS.DOCS_READ_FILE,
    async (_event: Electron.IpcMainInvokeEvent, payload: unknown) => {
      const parsed = readFilePayloadSchema.safeParse(payload)
      if (!parsed.success) {
        throw new Error('Invalid file name')
      }

      const folder = selectedFolderPath
      if (!folder) {
        throw new Error('No folder selected')
      }

      const filePath = path.join(folder, parsed.data.name)

      try {
        // Resolve symlinks and validate path stays within the selected folder
        const resolvedFolder = await realpath(folder)
        let realFilePath: string
        try {
          realFilePath = await realpath(filePath)
        } catch {
          throw new Error('File not found')
        }
        if (!realFilePath.startsWith(resolvedFolder + path.sep)) {
          throw new Error('Access denied: path is outside selected folder')
        }

        // Reject symlinks explicitly
        const fileInfo = await lstat(filePath)
        if (fileInfo.isSymbolicLink()) {
          throw new Error('Access denied: symlinks are not allowed')
        }
        if (fileInfo.size > MAX_FILE_SIZE) {
          throw new Error('File too large (max 10MB)')
        }

        const content = await readFile(filePath, 'utf-8')
        return { name: parsed.data.name, content }
      } catch (err) {
        if (err instanceof Error && (
          err.message === 'File not found' ||
          err.message === 'Access denied: path is outside selected folder' ||
          err.message === 'Access denied: symlinks are not allowed' ||
          err.message === 'File too large (max 10MB)'
        )) {
          throw err
        }
        console.error('DOCS_READ_FILE error:', err)
        throw new Error('Could not read file. It may have been moved or deleted.')
      }
    }
  )
}
