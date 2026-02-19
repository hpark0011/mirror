export function DocumentViewContent({
  content,
  isLoading,
  error,
  onBack,
}: {
  content: string | null
  isLoading: boolean
  error: string | null
  onBack: () => void
}) {
  return (
    <div className="flex-1 overflow-auto">
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading file...</p>
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back to file list
          </button>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap break-words p-6 text-sm leading-relaxed text-foreground font-mono">
          {content}
        </pre>
      )}
    </div>
  )
}
