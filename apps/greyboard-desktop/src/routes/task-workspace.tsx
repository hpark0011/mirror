import { TaskWorkspace } from '@feel-good/greyboard-core/workspace'
import { desktopStorageAdapter } from '@/src/lib/persistence/desktop-storage-adapter'

export function TaskWorkspaceRoute() {
  return <TaskWorkspace storage={desktopStorageAdapter} source='desktop' />
}
