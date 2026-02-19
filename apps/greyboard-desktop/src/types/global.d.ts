import { type DesktopAPI } from '@/electron/lib/desktop-api'

declare global {
  interface Window {
    greyboardDesktop?: DesktopAPI
  }
}
