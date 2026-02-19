import { type BrowserWindow } from 'electron'
import { registerAppHandlers } from './app'
import { registerDocHandlers } from './docs'
import { registerNotificationHandlers } from './notifications'
import { registerUpdateHandlers } from './updates'

export async function registerAllHandlers(mainWindow: BrowserWindow) {
  registerAppHandlers()
  await registerDocHandlers(mainWindow)
  registerNotificationHandlers()
  registerUpdateHandlers(mainWindow)
}
