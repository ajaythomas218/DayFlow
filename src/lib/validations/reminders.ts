import { z } from 'zod'

export const reminderChannelEnum = z.enum(['in_app', 'web_push', 'email'])

export const reminderRuleSchema = z.object({
  id: z.string().uuid().optional(),
  offset_minutes: z
    .number()
    .int('Offset must be an integer')
    .min(0, 'Offset cannot be negative')
    .max(43200, 'Offset cannot exceed 30 days (43,200 minutes)'),
  is_relative_to_start: z.boolean().default(true),
  channel: reminderChannelEnum.default('in_app'),
  is_active: z.boolean().default(true),
})

export const reminderSettingsSchema = z.object({
  task_default_reminders: z.array(reminderRuleSchema).default([
    { offset_minutes: 15, is_relative_to_start: true, channel: 'in_app', is_active: true },
  ]),
  event_default_reminders: z.array(reminderRuleSchema).default([
    { offset_minutes: 10, is_relative_to_start: true, channel: 'in_app', is_active: true },
  ]),
  reminders_enabled_by_default: z.boolean().default(true),
})

export type ReminderRuleInput = z.infer<typeof reminderRuleSchema>
export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>

