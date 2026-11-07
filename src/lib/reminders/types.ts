import { ReminderRule, ReminderDelivery } from '@/types'

export type ReminderChannel = 'in_app' | 'web_push' | 'email'

export interface ReminderItemInput {
  id?: string
  offset_minutes: number
  is_relative_to_start: boolean
  channel: ReminderChannel
  is_active?: boolean
}

export interface NotificationPayload {
  deliveryId: string
  userId: string
  title: string
  body: string
  channel: ReminderChannel
  targetUrl?: string
  scheduledFor: string
  metadata?: Record<string, unknown>
}

export interface DeliveryResult {
  success: boolean
  channel: string
  sentAt?: string
  isTransient?: boolean
  errorMessage?: string
}

export interface INotificationProvider {
  channel: ReminderChannel
  isConfigured(): boolean
  send(payload: NotificationPayload): Promise<DeliveryResult>
}

export type ReminderDeliveryWithDetails = ReminderDelivery & {
  rule?: ReminderRule | null
  task?: { id: string; title: string; status: string } | null
  event?: { id: string; title: string } | null
}

