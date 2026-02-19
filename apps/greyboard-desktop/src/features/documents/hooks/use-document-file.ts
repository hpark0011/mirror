import { useEffect, useState } from 'react'
import { desktopAPI } from '@/src/lib/ipc/client'

export function useDocumentFile(name: string | undefined) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!name) {
      setError('No file name provided')
      setIsLoading(false)
      return
    }

    const fileName = name
    let cancelled = false

    async function loadFile() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await desktopAPI.docs.readFile(fileName)
        if (cancelled) return
        if (!result) {
          setError('File could not be read. It may have been moved or deleted.')
        } else {
          setContent(result.content)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to read file')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadFile()
    return () => {
      cancelled = true
    }
  }, [name])

  return { content, isLoading, error }
}
