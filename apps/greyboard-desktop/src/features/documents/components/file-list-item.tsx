import { memo } from 'react'
import { DocFillIcon } from '@feel-good/icons'
import { type DocumentFile } from '@/electron/lib/desktop-api'
import { formatBytes } from '@/src/features/documents/utils/format-bytes'
import { formatRelativeDate } from '@/src/features/documents/utils/format-relative-date'

export const FileListItem = memo(function FileListItem({
  file,
  onSelect,
}: {
  file: DocumentFile
  onSelect: (name: string) => void
}) {
  const displayName = file.name.replace(/\.md$/, '')
  return (
    <button
      type="button"
      onClick={() => onSelect(file.name)}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
    >
      <DocFillIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-card-foreground">{displayName}</p>
        <p className="text-xs text-muted-foreground">
          {formatRelativeDate(file.lastModified)} · {formatBytes(file.sizeBytes)}
        </p>
      </div>
    </button>
  )
})
