import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@feel-good/ui/primitives/button'
import {
  createSnapshotFromBoard,
  type GreyboardSnapshotV2,
} from '@feel-good/utils/greyboard-snapshot'
import { desktopAPI } from '@/src/lib/ipc/client'

type ColumnId = 'backlog' | 'to-do' | 'in-progress' | 'complete'

interface TaskItem {
  id: string
  title: string
  description: string
  status: ColumnId
  createdAt: string
  updatedAt: string
  completedAt: string | null
  duration: number
  subTasks: Array<{ id: string; text: string; completed: boolean }>
  timeEntries: Array<{ start: string; end: string; duration: number }>
}

type TaskBoard = Record<ColumnId, TaskItem[]>

const COLUMN_ORDER: ColumnId[] = ['backlog', 'to-do', 'in-progress', 'complete']

const COLUMN_LABELS: Record<ColumnId, string> = {
  backlog: 'Backlog',
  'to-do': 'To Do',
  'in-progress': 'In Progress',
  complete: 'Complete',
}

function createEmptyBoard(): TaskBoard {
  return {
    backlog: [],
    'to-do': [],
    'in-progress': [],
    complete: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeTask(rawTask: unknown, fallbackStatus: ColumnId): TaskItem | null {
  if (!isRecord(rawTask)) {
    return null
  }

  const now = new Date().toISOString()
  const id = typeof rawTask.id === 'string' ? rawTask.id : crypto.randomUUID()
  const title = typeof rawTask.title === 'string' ? rawTask.title : ''

  if (title.length === 0) {
    return null
  }

  const status =
    rawTask.status === 'backlog' ||
    rawTask.status === 'to-do' ||
    rawTask.status === 'in-progress' ||
    rawTask.status === 'complete'
      ? rawTask.status
      : fallbackStatus

  return {
    id,
    title,
    description: typeof rawTask.description === 'string' ? rawTask.description : '',
    status,
    createdAt: typeof rawTask.createdAt === 'string' ? rawTask.createdAt : now,
    updatedAt: typeof rawTask.updatedAt === 'string' ? rawTask.updatedAt : now,
    completedAt:
      typeof rawTask.completedAt === 'string' || rawTask.completedAt === null
        ? rawTask.completedAt
        : null,
    duration: typeof rawTask.duration === 'number' ? rawTask.duration : 0,
    subTasks: Array.isArray(rawTask.subTasks)
      ? rawTask.subTasks.filter(
          (subTask): subTask is { id: string; text: string; completed: boolean } =>
            isRecord(subTask) &&
            typeof subTask.id === 'string' &&
            typeof subTask.text === 'string' &&
            typeof subTask.completed === 'boolean'
        )
      : [],
    timeEntries: Array.isArray(rawTask.timeEntries)
      ? rawTask.timeEntries.filter(
          (entry): entry is { start: string; end: string; duration: number } =>
            isRecord(entry) &&
            typeof entry.start === 'string' &&
            typeof entry.end === 'string' &&
            typeof entry.duration === 'number'
        )
      : [],
  }
}

function normalizeBoard(snapshot: GreyboardSnapshotV2): TaskBoard {
  const nextBoard = createEmptyBoard()

  for (const columnId of COLUMN_ORDER) {
    const rawColumn = snapshot.board[columnId]
    if (!Array.isArray(rawColumn)) {
      continue
    }

    nextBoard[columnId] = rawColumn
      .map((task) => normalizeTask(task, columnId))
      .filter((task): task is TaskItem => task !== null)
  }

  return nextBoard
}

function toSnapshot(board: TaskBoard): GreyboardSnapshotV2 {
  return createSnapshotFromBoard(board, { source: 'desktop' })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not read snapshot file'))
      }
    }
    reader.onerror = () => {
      reject(new Error('Could not read snapshot file'))
    }
    reader.readAsText(file)
  })
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

export function TaskWorkspace() {
  const [board, setBoard] = useState<TaskBoard>(() => createEmptyBoard())
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const totalTasks = useMemo(
    () => COLUMN_ORDER.reduce((count, columnId) => count + board[columnId].length, 0),
    [board]
  )

  const persistBoard = useCallback(async (nextBoard: TaskBoard) => {
    setIsSaving(true)
    try {
      await desktopAPI.state.save(toSnapshot(nextBoard))
      setError(null)
    } catch (persistError) {
      setError(
        persistError instanceof Error
          ? persistError.message
          : 'Failed to persist desktop task state'
      )
    } finally {
      setIsSaving(false)
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    const loadState = async () => {
      setIsLoading(true)
      try {
        const snapshot = await desktopAPI.state.load()
        if (!isCancelled) {
          setBoard(normalizeBoard(snapshot))
          setError(null)
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load task state')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadState()

    return () => {
      isCancelled = true
    }
  }, [])

  const addTask = useCallback(async () => {
    const title = newTaskTitle.trim()
    if (!title) {
      return
    }

    const now = new Date().toISOString()
    const newTask: TaskItem = {
      id: crypto.randomUUID(),
      title,
      description: '',
      status: 'backlog',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      duration: 0,
      subTasks: [],
      timeEntries: [],
    }

    const nextBoard: TaskBoard = {
      ...board,
      backlog: [newTask, ...board.backlog],
    }

    setBoard(nextBoard)
    setNewTaskTitle('')
    await persistBoard(nextBoard)
  }, [board, newTaskTitle, persistBoard])

  const deleteTask = useCallback(
    async (columnId: ColumnId, taskId: string) => {
      const nextBoard: TaskBoard = {
        ...board,
        [columnId]: board[columnId].filter((task) => task.id !== taskId),
      }

      setBoard(nextBoard)
      await persistBoard(nextBoard)
    },
    [board, persistBoard]
  )

  const moveTask = useCallback(
    async (columnId: ColumnId, taskId: string, direction: 'left' | 'right') => {
      const fromIndex = COLUMN_ORDER.indexOf(columnId)
      const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1
      if (toIndex < 0 || toIndex >= COLUMN_ORDER.length) {
        return
      }

      const targetColumnId = COLUMN_ORDER[toIndex]
      if (!targetColumnId) {
        return
      }
      const task = board[columnId].find((item) => item.id === taskId)
      if (!task) {
        return
      }

      const now = new Date().toISOString()
      const movedTask: TaskItem = {
        ...task,
        status: targetColumnId,
        updatedAt: now,
        completedAt: targetColumnId === 'complete' ? now : null,
      }

      const nextBoard: TaskBoard = {
        ...board,
        [columnId]: board[columnId].filter((item) => item.id !== taskId),
        [targetColumnId]: [movedTask, ...board[targetColumnId]],
      }

      setBoard(nextBoard)
      await persistBoard(nextBoard)
    },
    [board, persistBoard]
  )

  const handleImportSnapshot = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      try {
        const content = await readFileAsText(file)
        const imported = await desktopAPI.state.importSnapshot(content)
        setBoard(normalizeBoard(imported))
        setError(null)
      } catch (importError) {
        setError(
          importError instanceof Error ? importError.message : 'Failed to import snapshot'
        )
      } finally {
        if (importInputRef.current) {
          importInputRef.current.value = ''
        }
      }
    },
    []
  )

  const exportSnapshot = useCallback(async () => {
    try {
      const serializedSnapshot = await desktopAPI.state.exportSnapshot()
      const dateStamp = new Date().toISOString().slice(0, 10)
      triggerDownload(serializedSnapshot, `greyboard-snapshot-${dateStamp}.json`)
      setError(null)
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : 'Failed to export snapshot'
      )
    }
  }, [])

  const clearBoard = useCallback(async () => {
    const nextBoard = createEmptyBoard()
    setBoard(nextBoard)
    await persistBoard(nextBoard)
  }, [persistBoard])

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <p className='text-sm text-muted-foreground'>Loading desktop task workspace...</p>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col gap-4 p-4'>
      <section className='rounded-lg border border-border bg-card p-4'>
        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <div className='space-y-1'>
            <h1 className='text-xl font-semibold'>TaskWorkspace</h1>
            <p className='text-sm text-muted-foreground'>
              Local desktop state is persisted through Electron main-process JSON storage.
            </p>
            <p className='text-xs text-muted-foreground'>Total tasks: {totalTasks}</p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' onClick={() => importInputRef.current?.click()}>
              Import snapshot
            </Button>
            <Button variant='outline' onClick={exportSnapshot}>
              Export snapshot
            </Button>
            <Button variant='outline' onClick={clearBoard}>
              Clear board
            </Button>
            <span className='text-xs text-muted-foreground'>
              {isSaving ? 'Saving...' : 'Saved locally'}
            </span>
          </div>
        </div>

        <div className='mt-4 flex flex-col gap-2 sm:flex-row'>
          <input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            placeholder='Add a task to backlog'
            className='h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm'
          />
          <Button onClick={() => void addTask()}>Add task</Button>
        </div>
      </section>

      {error ? (
        <p className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
          {error}
        </p>
      ) : null}

      <section className='grid flex-1 gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-4'>
        {COLUMN_ORDER.map((columnId) => {
          const tasks = board[columnId]

          return (
            <div key={columnId} className='flex min-h-[240px] flex-col rounded-lg border border-border'>
              <div className='border-b border-border px-3 py-2'>
                <h2 className='text-sm font-medium'>
                  {COLUMN_LABELS[columnId]} ({tasks.length})
                </h2>
              </div>
              <div className='flex flex-1 flex-col gap-2 overflow-auto p-3'>
                {tasks.length === 0 ? (
                  <p className='text-xs text-muted-foreground'>No tasks</p>
                ) : (
                  tasks.map((task) => (
                    <article
                      key={task.id}
                      className='space-y-2 rounded-md border border-border bg-background p-3'
                    >
                      <p className='text-sm font-medium'>{task.title}</p>
                      <div className='flex items-center gap-1'>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={columnId === COLUMN_ORDER[0]}
                          onClick={() => void moveTask(columnId, task.id, 'left')}
                        >
                          {'<'}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={columnId === COLUMN_ORDER[COLUMN_ORDER.length - 1]}
                          onClick={() => void moveTask(columnId, task.id, 'right')}
                        >
                          {'>'}
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-destructive'
                          onClick={() => void deleteTask(columnId, task.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </section>

      <input
        ref={importInputRef}
        type='file'
        accept='.json'
        onChange={(event) => void handleImportSnapshot(event)}
        className='hidden'
      />
    </div>
  )
}
