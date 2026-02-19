import { z } from 'zod'

export const notificationPayloadSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
})

export const readFilePayloadSchema = z.object({
  name: z
    .string()
    .min(1, 'File name cannot be empty')
    .max(255, 'File name too long')
    .refine((name) => !name.includes('/') && !name.includes('\\'), {
      message: 'File name must not contain path separators',
    })
    .refine((name) => !name.includes('..'), {
      message: 'File name must not contain path traversal',
    })
    .refine((name) => !name.includes('\0'), {
      message: 'File name must not contain null bytes',
    })
    .refine((name) => name.endsWith('.md'), {
      message: 'Only markdown files are allowed',
    }),
})

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>
export type ReadFilePayload = z.infer<typeof readFilePayloadSchema>
