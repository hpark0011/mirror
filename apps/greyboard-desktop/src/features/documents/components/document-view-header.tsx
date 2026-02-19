import { ArrowBackwardIcon } from '@feel-good/icons'
import { Button } from '@feel-good/ui/primitives/button'

export function DocumentViewHeader({
  displayName,
  fileName,
  onBack,
}: {
  displayName: string
  fileName: string
  onBack: () => void
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-6 py-3">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onBack}
        title="Back to file list"
      >
        <ArrowBackwardIcon className="size-4" />
      </Button>
      <h2 className="truncate text-sm font-medium" title={fileName}>
        {displayName}
      </h2>
    </div>
  )
}
