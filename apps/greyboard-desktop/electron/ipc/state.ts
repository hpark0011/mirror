import { app, ipcMain } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  createEmptySnapshot,
  deserializeSnapshot,
  serializeSnapshot,
  type GreyboardSnapshotV2,
} from '@feel-good/utils/greyboard-snapshot'
import { CHANNELS } from '../lib/channels'
import {
  stateImportPayloadSchema,
  stateSavePayloadSchema,
} from '../lib/validators'

const STATE_FILE_NAME = 'greyboard-state.json'

function getStateFilePath(): string {
  return path.join(app.getPath('userData'), STATE_FILE_NAME)
}

function normalizeForDesktop(snapshot: GreyboardSnapshotV2): GreyboardSnapshotV2 {
  return {
    ...snapshot,
    metadata: {
      ...snapshot.metadata,
      exportedAt: new Date().toISOString(),
      source: 'desktop',
    },
  }
}

async function writeSnapshot(snapshot: GreyboardSnapshotV2): Promise<GreyboardSnapshotV2> {
  const persistedSnapshot = normalizeForDesktop(snapshot)
  const statePath = getStateFilePath()
  const tempPath = `${statePath}.tmp`

  await mkdir(path.dirname(statePath), { recursive: true })
  await writeFile(tempPath, serializeSnapshot(persistedSnapshot), 'utf-8')
  await rename(tempPath, statePath)

  return persistedSnapshot
}

async function loadSnapshotFromDisk(): Promise<GreyboardSnapshotV2> {
  const statePath = getStateFilePath()

  try {
    const rawState = await readFile(statePath, 'utf-8')
    const parsed = JSON.parse(rawState)
    return deserializeSnapshot(parsed)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createEmptySnapshot('desktop')
    }

    try {
      const corruptPath = `${statePath}.corrupt-${Date.now()}`
      await rename(statePath, corruptPath)
    } catch {
      // Best-effort backup for corrupt files
    }

    return createEmptySnapshot('desktop')
  }
}

function parseSnapshotPayload(payload: unknown): GreyboardSnapshotV2 {
  const parsed = stateSavePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(`Invalid state payload: ${parsed.error.message}`)
  }

  if (typeof parsed.data.snapshot === 'string') {
    return deserializeSnapshot(parsed.data.snapshot)
  }

  return deserializeSnapshot(JSON.stringify(parsed.data.snapshot))
}

export function registerStateHandlers() {
  ipcMain.handle(CHANNELS.STATE_LOAD, async () => {
    return loadSnapshotFromDisk()
  })

  ipcMain.handle(
    CHANNELS.STATE_SAVE,
    async (_event: Electron.IpcMainInvokeEvent, payload: unknown) => {
      const snapshot = parseSnapshotPayload(payload)
      return writeSnapshot(snapshot)
    }
  )

  ipcMain.handle(
    CHANNELS.STATE_IMPORT,
    async (_event: Electron.IpcMainInvokeEvent, payload: unknown) => {
      const parsed = stateImportPayloadSchema.parse(payload)
      const snapshot = deserializeSnapshot(parsed.json)
      return writeSnapshot(snapshot)
    }
  )

  ipcMain.handle(CHANNELS.STATE_EXPORT, async () => {
    const snapshot = await loadSnapshotFromDisk()
    return serializeSnapshot(snapshot)
  })
}
