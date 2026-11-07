import { GoogleCalendarEventPayload } from './types'

const BASE_URL = 'https://www.googleapis.com/calendar/v3'

export interface ListEventsResponse {
  items?: GoogleCalendarEventPayload[]
  nextSyncToken?: string
  nextPageToken?: string
  isSyncTokenInvalid?: boolean // HTTP 410 Gone
}

export class GoogleCalendarClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retriesLeft: number = 2
  ): Promise<{ data?: T; status: number; etag?: string | null }> {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', `Bearer ${this.accessToken}`)
    headers.set('Accept', 'application/json')

    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(url, {
      ...options,
      headers,
    })

    const etag = res.headers.get('ETag')

    // Handle transient rate limits (429) and server errors (5xx) with backoff retry
    if ((res.status === 429 || res.status >= 500) && retriesLeft > 0) {
      const delayMs = (3 - retriesLeft) * 1000 + Math.floor(Math.random() * 200)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return this.request<T>(endpoint, options, retriesLeft - 1)
    }

    if (res.status === 204) {
      return { status: 204, etag }
    }

    if (res.status === 410) {
      return { status: 410, etag }
    }

    if (res.status === 412) {
      return { status: 412, etag }
    }

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Google Calendar API error (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as T
    return { data, status: res.status, etag }
  }

  /**
   * Retrieves a single event from Google Calendar by ID.
   */
  async getEvent(
    calendarId: string = 'primary',
    eventId: string
  ): Promise<{ event?: GoogleCalendarEventPayload; etag?: string | null; isNotFound?: boolean }> {
    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    try {
      const res = await this.request<GoogleCalendarEventPayload>(endpoint, { method: 'GET' })
      if (res.status === 404 || res.status === 410) {
        return { isNotFound: true }
      }
      return { event: res.data, etag: res.etag || res.data?.etag || null }
    } catch {
      return { isNotFound: true }
    }
  }

  /**
   * Lists events from a calendar, supporting incremental sync via syncToken or window query.
   */
  async listEvents(
    calendarId: string = 'primary',
    params: {
      syncToken?: string
      timeMin?: string
      timeMax?: string
      pageToken?: string
      singleEvents?: boolean
      maxResults?: number
    } = {}
  ): Promise<ListEventsResponse> {
    const query = new URLSearchParams()

    if (params.syncToken) {
      query.set('syncToken', params.syncToken)
    } else {
      if (params.timeMin) query.set('timeMin', params.timeMin)
      if (params.timeMax) query.set('timeMax', params.timeMax)
    }

    if (params.pageToken) query.set('pageToken', params.pageToken)
    if (params.singleEvents !== undefined) query.set('singleEvents', String(params.singleEvents))
    query.set('maxResults', String(params.maxResults || 100))

    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`
    const res = await this.request<{
      items?: GoogleCalendarEventPayload[]
      nextSyncToken?: string
      nextPageToken?: string
    }>(endpoint)

    if (res.status === 410) {
      return {
        items: [],
        isSyncTokenInvalid: true,
      }
    }

    return {
      items: res.data?.items || [],
      nextSyncToken: res.data?.nextSyncToken,
      nextPageToken: res.data?.nextPageToken,
    }
  }

  /**
   * Inserts an event into Google Calendar.
   */
  async insertEvent(
    calendarId: string = 'primary',
    payload: GoogleCalendarEventPayload
  ): Promise<{ event: GoogleCalendarEventPayload; etag: string | null }> {
    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events`
    const res = await this.request<GoogleCalendarEventPayload>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    return {
      event: res.data!,
      etag: res.etag || res.data?.etag || null,
    }
  }

  /**
   * Updates (patches) an existing event in Google Calendar with conditional ETag support.
   */
  async patchEvent(
    calendarId: string = 'primary',
    eventId: string,
    payload: Partial<GoogleCalendarEventPayload>,
    options?: { ifMatch?: string }
  ): Promise<{ event?: GoogleCalendarEventPayload; etag?: string | null; isConflict?: boolean; isNotFound?: boolean }> {
    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    const headers: Record<string, string> = {}
    if (options?.ifMatch) {
      headers['If-Match'] = options.ifMatch
    }

    const res = await this.request<GoogleCalendarEventPayload>(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })

    if (res.status === 412) {
      return { isConflict: true }
    }

    if (res.status === 404 || res.status === 410) {
      return { isNotFound: true }
    }

    return {
      event: res.data,
      etag: res.etag || res.data?.etag || null,
    }
  }

  /**
   * Deletes an event in Google Calendar.
   */
  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<boolean> {
    const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    try {
      const res = await this.request<void>(endpoint, { method: 'DELETE' })
      return res.status === 204 || res.status === 410 || res.status === 404
    } catch {
      return false
    }
  }
}
