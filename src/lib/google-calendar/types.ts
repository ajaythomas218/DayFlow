/**
 * Google Calendar Bidirectional Integration Architecture Types
 *
 * Defines the contract, mapping protocols, sync state, and conflict
 * resolution data models for Workday OS <-> Google Calendar sync.
 */

export type SyncDirection = 'bidirectional' | 'push_only' | 'pull_only'

export type SyncStatus =
  | 'synced'
  | 'pending_push'
  | 'pending_pull'
  | 'conflict'
  | 'orphaned'

export type ConflictResolutionPolicy =
  | 'last_write_wins'
  | 'prefer_google'
  | 'prefer_workday'
  | 'manual_review'

export interface GoogleCalendarEventPayload {
  id?: string
  summary: string
  description?: string
  location?: string
  start: {
    dateTime?: string // RFC3339 formatted
    date?: string // YYYY-MM-DD for all-day
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted'
  }>
  recurrence?: string[] // RRULE format
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: 'video' | 'phone' | 'more'
      uri: string
      label?: string
    }>
  }
  status?: 'confirmed' | 'tentative' | 'cancelled'
  etag?: string
  updated?: string
}

export interface SyncMappingRecord {
  id: string
  user_id: string
  calendar_connection_id: string
  task_id: string | null
  calendar_event_id: string | null
  google_calendar_id: string
  google_event_id: string
  etag: string | null
  sync_direction: SyncDirection
  last_synced_at: string
  remote_updated_at?: string | null
  sync_status: SyncStatus
}

export interface SyncStateRecord {
  id: string
  calendar_connection_id: string
  google_calendar_id: string
  sync_token: string | null
  channel_id: string | null
  resource_id: string | null
  channel_expiration: string | null
  sync_status: 'idle' | 'syncing' | 'error'
  sync_started_at: string | null
  last_pushed_count: number
  last_pulled_count: number
  last_conflict_count: number
  last_successful_sync: string | null
  last_error_message: string | null
  updated_at: string
}

export interface SyncResult {
  pushedCount: number
  pulledCount: number
  conflictCount: number
  errors: Array<{ recordId: string; error: string }>
  nextSyncToken?: string
}

