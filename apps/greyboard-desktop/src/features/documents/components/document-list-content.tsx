import { type DocumentFile } from '@/electron/lib/desktop-api'
import { FileListItem } from './file-list-item'

export function DocumentListContent({
  files,
  isLoading,
  onSelectFile,
  onChangeFolder,
}: {
  files: DocumentFile[]
  isLoading: boolean
  onSelectFile: (name: string) => void
  onChangeFolder: () => void
}) {
  return (
    <div className="flex-1 overflow-auto p-6">
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">Scanning folder...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-center">
          <p className="text-sm text-muted-foreground">
            No markdown files found in this folder.
          </p>
          <button
            type="button"
            onClick={onChangeFolder}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Try a different folder
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <FileListItem key={file.name} file={file} onSelect={onSelectFile} />
          ))}
        </div>
      )}
    </div>
  )
}
