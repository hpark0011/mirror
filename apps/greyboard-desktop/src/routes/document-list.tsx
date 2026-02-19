import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@feel-good/ui/primitives/button'
import { useDocumentStore } from '@/src/state/document-store'
import { EmptyState } from '@/src/features/documents/components/empty-state'
import { DocumentListHeader } from '@/src/features/documents/components/document-list-header'
import { DocumentListContent } from '@/src/features/documents/components/document-list-content'

export function DocumentList() {
  const { folderPath, files, isLoading, error, selectFolder, loadFolder } = useDocumentStore()

  const navigate = useNavigate()
  const handleSelectFile = useCallback(
    (name: string) => navigate(`/document/${encodeURIComponent(name)}`),
    [navigate],
  )

  useEffect(() => {
    loadFolder()
  }, [loadFolder])

  if (isLoading && !folderPath) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error && !folderPath) {
    return (
      <EmptyState
        title="Folder not found"
        description={error}
        action={<Button onClick={selectFolder}>Select New Folder</Button>}
      />
    )
  }

  if (!folderPath) {
    return (
      <EmptyState
        title="No folder selected"
        description="Select a folder containing your markdown documents to get started."
        action={<Button onClick={selectFolder}>Select Folder</Button>}
      />
    )
  }

  const folderName = folderPath.split(/[/\\]/).pop() ?? folderPath

  return (
    <div className="flex h-full flex-col">
      <DocumentListHeader
        folderName={folderName}
        folderPath={folderPath}
        fileCount={files.length}
        isLoading={isLoading}
        onRefresh={loadFolder}
        onChangeFolder={selectFolder}
      />
      <DocumentListContent
        files={files}
        isLoading={isLoading}
        onSelectFile={handleSelectFile}
        onChangeFolder={selectFolder}
      />
    </div>
  )
}
