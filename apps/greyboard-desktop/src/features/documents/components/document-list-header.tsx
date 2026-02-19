import { ArrowClockwiseIcon } from '@feel-good/icons'
import { Button } from '@feel-good/ui/primitives/button'

export function DocumentListHeader({
  folderName,
  folderPath,
  fileCount,
  isLoading,
  onRefresh,
  onChangeFolder,
}: {
  folderName: string
  folderPath: string
  fileCount: number
  isLoading: boolean
  onRefresh: () => void
  onChangeFolder: () => void
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-medium" title={folderPath}>
          {folderName}
        </h2>
        <p className="text-xs text-muted-foreground">
          {fileCount} {fileCount === 1 ? 'document' : 'documents'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <ArrowClockwiseIcon className="size-4" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={onChangeFolder}>
          Change Folder
        </Button>
      </div>
    </div>
  )
}
