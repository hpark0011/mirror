import { z } from 'zod'

export const notificationPayloadSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
})

export const stateSavePayloadSchema = z.object({
  snapshot: z.unknown(),
})

export const stateImportPayloadSchema = z.object({
  json: z.string().min(1),
})

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>
export type StateSavePayload = z.infer<typeof stateSavePayloadSchema>
export type StateImportPayload = z.infer<typeof stateImportPayloadSchema>
