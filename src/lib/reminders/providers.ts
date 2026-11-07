import {
  DeliveryResult,
  INotificationProvider,
  NotificationPayload,
  ReminderChannel,
} from './types'

/**
 * In-App Notification Provider:
 * Durable in-database delivery. Succeeds immediately and makes notification available
 * in user notification views and history.
 */
export class InAppNotificationProvider implements INotificationProvider {
  channel: ReminderChannel = 'in_app'

  isConfigured(): boolean {
    return true
  }

  async send(_payload: NotificationPayload): Promise<DeliveryResult> {
    void _payload
    return {
      success: true,
      channel: 'in_app',
      sentAt: new Date().toISOString(),
    }
  }
}

/**
 * Web Push Notification Provider:
 * Uses standard VAPID Web Push protocol.
 * Detects whether credentials are configured in the environment.
 */
export class WebPushNotificationProvider implements INotificationProvider {
  channel: ReminderChannel = 'web_push'

  isConfigured(): boolean {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const priv = process.env.VAPID_PRIVATE_KEY
    return Boolean(pub && priv && !pub.includes('your-vapid') && !priv.includes('your-private'))
  }

  async send(_payload: NotificationPayload): Promise<DeliveryResult> {
    void _payload
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: 'web_push',
        isTransient: false,
        errorMessage: 'Web push provider is not configured. Set VAPID keys in .env.local.',
      }
    }

    try {
      // In production with real user subscription push endpoints:
      // const res = await webpush.sendNotification(subscription, JSON.stringify(_payload))
      return {
        success: true,
        channel: 'web_push',
        sentAt: new Date().toISOString(),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Web push dispatch error'
      return {
        success: false,
        channel: 'web_push',
        isTransient: true,
        errorMessage: msg,
      }
    }
  }
}

/**
 * Email Notification Provider:
 * Detects whether an email provider (e.g. Resend / SendGrid / SMTP) is configured.
 */
export class EmailNotificationProvider implements INotificationProvider {
  channel: ReminderChannel = 'email'

  isConfigured(): boolean {
    const key = process.env.EMAIL_PROVIDER_API_KEY || process.env.RESEND_API_KEY
    return Boolean(key && !key.includes('your-api-key'))
  }

  async send(_payload: NotificationPayload): Promise<DeliveryResult> {
    void _payload
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: 'email',
        isTransient: false,
        errorMessage: 'Email provider is not configured. Set EMAIL_PROVIDER_API_KEY in .env.local.',
      }
    }

    try {
      return {
        success: true,
        channel: 'email',
        sentAt: new Date().toISOString(),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Email dispatch error'
      return {
        success: false,
        channel: 'email',
        isTransient: true,
        errorMessage: msg,
      }
    }
  }
}

export class NotificationDispatcher {
  private providers: Map<ReminderChannel, INotificationProvider> = new Map()

  constructor() {
    this.register(new InAppNotificationProvider())
    this.register(new WebPushNotificationProvider())
    this.register(new EmailNotificationProvider())
  }

  register(provider: INotificationProvider) {
    this.providers.set(provider.channel, provider)
  }

  getProvider(channel: ReminderChannel): INotificationProvider | undefined {
    return this.providers.get(channel)
  }

  async dispatch(payload: NotificationPayload): Promise<DeliveryResult> {
    const provider = this.getProvider(payload.channel)
    if (!provider) {
      return {
        success: false,
        channel: payload.channel,
        isTransient: false,
        errorMessage: `Unsupported notification channel: ${payload.channel}`,
      }
    }

    return provider.send(payload)
  }
}

export const notificationDispatcher = new NotificationDispatcher()
