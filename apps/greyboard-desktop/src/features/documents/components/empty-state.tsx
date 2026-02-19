import { type ReactNode } from 'react'
import { FolderFillIcon } from '@feel-good/icons'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="text-muted-foreground">
          <FolderFillIcon className="size-12" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </div>
  )
}
