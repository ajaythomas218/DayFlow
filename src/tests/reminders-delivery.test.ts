import { describe, it, expect } from 'vitest'
import {
  calculateDeliveryTime,
  getNextRetryTimestamp,
  EXPONENTIAL_BACKOFF_MS,
} from '@/lib/reminders/scheduler'
import {
  InAppNotificationProvider,
  WebPushNotificationProvider,
  EmailNotificationProvider,
  notificationDispatcher,
} from '@/lib/reminders/providers'

describe('Reminder Scheduling, Backoff & Provider Dispatch', () => {
  const baseTimeIso = '2026-10-28T10:00:00.000Z'

  it('calculates scheduled delivery times from offsets correctly', () => {
    // 0 minutes (at time of event):
    expect(calculateDeliveryTime(baseTimeIso, 0)).toBe('2026-10-28T10:00:00.000Z')

    // 10 minutes before:
    expect(calculateDeliveryTime(baseTimeIso, 10)).toBe('2026-10-28T09:50:00.000Z')

    // 1 hour before (60 minutes):
    expect(calculateDeliveryTime(baseTimeIso, 60)).toBe('2026-10-28T09:00:00.000Z')

    // 1 day before (1440 minutes):
    expect(calculateDeliveryTime(baseTimeIso, 1440)).toBe('2026-10-27T10:00:00.000Z')
  })

  it('calculates exponential backoff timestamps for retrying failed deliveries', () => {
    const fixedNow = new Date('2026-10-28T10:00:00.000Z')

    // Attempt 1: 1 minute backoff
    const retry1 = getNextRetryTimestamp(1, fixedNow)
    expect(new Date(retry1).getTime() - fixedNow.getTime()).toBe(EXPONENTIAL_BACKOFF_MS[0]) // 60,000 ms

    // Attempt 2: 5 minutes backoff
    const retry2 = getNextRetryTimestamp(2, fixedNow)
    expect(new Date(retry2).getTime() - fixedNow.getTime()).toBe(EXPONENTIAL_BACKOFF_MS[1]) // 300,000 ms

    // Attempt 3: 15 minutes backoff
    const retry3 = getNextRetryTimestamp(3, fixedNow)
    expect(new Date(retry3).getTime() - fixedNow.getTime()).toBe(EXPONENTIAL_BACKOFF_MS[2]) // 900,000 ms
  })

  it('executes in-app delivery reliably and returns confirmation timestamp', async () => {
    const provider = new InAppNotificationProvider()
    expect(provider.isConfigured()).toBe(true)

    const result = await provider.send({
      deliveryId: 'del-123',
      userId: 'user-abc',
      title: 'Task Reminder',
      body: 'Prepare presentation',
      channel: 'in_app',
      scheduledFor: baseTimeIso,
    })

    expect(result.success).toBe(true)
    expect(result.channel).toBe('in_app')
    expect(result.sentAt).toBeDefined()
  })

  it('identifies unconfigured web push and email providers without reporting fake success', async () => {
    const pushProvider = new WebPushNotificationProvider()
    const emailProvider = new EmailNotificationProvider()

    // When environment variables are not populated:
    if (!pushProvider.isConfigured()) {
      const pushRes = await pushProvider.send({
        deliveryId: 'del-456',
        userId: 'user-abc',
        title: 'Push Reminder',
        body: 'Upcoming meeting',
        channel: 'web_push',
        scheduledFor: baseTimeIso,
      })
      expect(pushRes.success).toBe(false)
      expect(pushRes.isTransient).toBe(false)
      expect(pushRes.errorMessage).toContain('Web push provider is not configured')
    }

    if (!emailProvider.isConfigured()) {
      const emailRes = await emailProvider.send({
        deliveryId: 'del-789',
        userId: 'user-abc',
        title: 'Email Reminder',
        body: 'Deadline approaching',
        channel: 'email',
        scheduledFor: baseTimeIso,
      })
      expect(emailRes.success).toBe(false)
      expect(emailRes.isTransient).toBe(false)
      expect(emailRes.errorMessage).toContain('Email provider is not configured')
    }
  })

  it('dispatches to correct provider via notificationDispatcher', async () => {
    const inAppResult = await notificationDispatcher.dispatch({
      deliveryId: 'del-dispatch-1',
      userId: 'user-abc',
      title: 'Dispatcher Test',
      body: 'Testing notification dispatcher',
      channel: 'in_app',
      scheduledFor: baseTimeIso,
    })

    expect(inAppResult.success).toBe(true)
    expect(inAppResult.channel).toBe('in_app')
  })
})

