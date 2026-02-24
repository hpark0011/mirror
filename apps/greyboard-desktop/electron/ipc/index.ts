import { type BrowserWindow } from 'electron'
import { registerAppHandlers } from './app'
import { registerNotificationHandlers } from './notifications'
import { registerStateHandlers } from './state'
import { registerUpdateHandlers } from './updates'

export async function registerAllHandlers(mainWindow: BrowserWindow) {
  registerAppHandlers()
  registerStateHandlers()
  registerNotificationHandlers()
  registerUpdateHandlers(mainWindow)
}
