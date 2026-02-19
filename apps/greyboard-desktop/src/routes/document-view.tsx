import { useNavigate, useParams } from 'react-router-dom'
import { useDocumentFile } from '@/src/features/documents/hooks/use-document-file'
import { DocumentViewHeader } from '@/src/features/documents/components/document-view-header'
import { DocumentViewContent } from '@/src/features/documents/components/document-view-content'

export function DocumentView() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { content, isLoading, error } = useDocumentFile(name)

  const displayName = name?.replace(/\.md$/, '') ?? 'Unknown'
  const handleBack = () => navigate('/')

  return (
    <div className="flex h-full flex-col">
      <DocumentViewHeader
        displayName={displayName}
        fileName={name ?? ''}
        onBack={handleBack}
      />
      <DocumentViewContent
        content={content}
        isLoading={isLoading}
        error={error}
        onBack={handleBack}
      />
    </div>
  )
}
