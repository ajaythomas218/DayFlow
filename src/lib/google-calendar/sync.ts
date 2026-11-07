import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { GoogleCalendarClient } from './client'
import { getValidAccessTokenForUser } from './oauth'
import {
  GoogleCalendarEventPayload,
  SyncResult,
} from './types'

/**
 * Pushes local Workday OS events and time-blocked tasks to Google Calendar.
 * Supports conditional updates via ETags and handles HTTP 412 Precondition Failed.
 */
export async function pushWorkdayToGoogle(
  supabase: SupabaseClient<Database>,
  connectionId: string,
  userId: string,
  client: GoogleCalendarClient,
  userTimezone: string = 'UTC'
): Promise<{ pushedCount: number; conflictCount: number; errors: Array<{ recordId: string; error: string }> }> {
  let pushedCount = 0
  let conflictCount = 0
  const errors: Array<{ recordId: string; error: string }> = []

  // 1. Fetch user auto-sync preferences
  const { data: settings } = await supabase
    .from('user_settings')
    .select('auto_sync_tasks_to_calendar, auto_sync_events_to_calendar')
    .eq('user_id', userId)
    .single()

  const syncEventsDefault = settings?.auto_sync_events_to_calendar ?? true
  const syncTasksDefault = settings?.auto_sync_tasks_to_calendar ?? false

  // 2. Outbound Push: Calendar Events
  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)

  for (const event of events || []) {
    const shouldSync = event.sync_with_google ?? syncEventsDefault
    if (!shouldSync) continue

    const { data: mapping } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .eq('calendar_connection_id', connectionId)
      .eq('calendar_event_id', event.id)
      .maybeSingle()

    const payload: GoogleCalendarEventPayload = {
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      start: event.is_all_day
        ? { date: event.start_time.slice(0, 10) }
        : { dateTime: event.start_time, timeZone: userTimezone },
      end: event.is_all_day
        ? { date: event.end_time.slice(0, 10) }
        : { dateTime: event.end_time, timeZone: userTimezone },
      attendees: Array.isArray(event.attendees)
        ? (event.attendees as Array<{ email: string; name?: string }>).map((a) => ({
            email: a.email,
            displayName: a.name,
          }))
        : undefined,
    }

    try {
      if (mapping) {
        // Only patch if local was updated after last successful sync
        if (new Date(event.updated_at).getTime() > new Date(mapping.last_synced_at).getTime()) {
          // Conditional update with ETag
          let patchRes = await client.patchEvent('primary', mapping.google_event_id, payload, {
            ifMatch: mapping.etag || undefined,
          })

          // Handle HTTP 412 Conflict: remote changed since last sync
          if (patchRes.isConflict) {
            conflictCount++
            const remote = await client.getEvent('primary', mapping.google_event_id)
            if (remote.event?.updated && new Date(remote.event.updated).getTime() > new Date(event.updated_at).getTime()) {
              // Remote is newer: reconcile local with remote
              await supabase
                .from('calendar_events')
                .update({
                  title: remote.event.summary || event.title,
                  description: remote.event.description !== undefined ? remote.event.description : event.description,
                  location: remote.event.location !== undefined ? remote.event.location : event.location,
                  start_time: remote.event.start?.dateTime || (remote.event.start?.date ? `${remote.event.start.date}T00:00:00.000Z` : event.start_time),
                  end_time: remote.event.end?.dateTime || (remote.event.end?.date ? `${remote.event.end.date}T00:00:00.000Z` : event.end_time),
                })
                .eq('id', event.id)
                .eq('user_id', userId)

              await supabase
                .from('calendar_event_mappings')
                .update({
                  etag: remote.etag || null,
                  remote_updated_at: remote.event.updated,
                  last_synced_at: new Date().toISOString(),
                  sync_status: 'synced',
                })
                .eq('id', mapping.id)
              continue
            } else {
              // Local is newer: force update with remote's latest ETag
              patchRes = await client.patchEvent('primary', mapping.google_event_id, payload, {
                ifMatch: remote.etag || undefined,
              })
            }
          }

          if (patchRes.event || patchRes.etag) {
            await supabase
              .from('calendar_event_mappings')
              .update({
                etag: patchRes.etag,
                remote_updated_at: patchRes.event?.updated || null,
                last_synced_at: new Date().toISOString(),
                sync_status: 'synced',
              })
              .eq('id', mapping.id)
            pushedCount++
          }
        }
      } else {
        // Insert new Google Event
        const { event: createdGEvent, etag } = await client.insertEvent('primary', payload)
        if (createdGEvent.id) {
          await supabase.from('calendar_event_mappings').insert({
            user_id: userId,
            calendar_connection_id: connectionId,
            calendar_event_id: event.id,
            task_id: null,
            google_calendar_id: 'primary',
            google_event_id: createdGEvent.id,
            etag,
            remote_updated_at: createdGEvent.updated || null,
            sync_direction: 'bidirectional',
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced',
          })
          pushedCount++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push error'
      errors.push({ recordId: event.id, error: msg })
    }
  }

  // 3. Outbound Push: Time-Blocked Tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_time_blocked', true)
    .not('scheduled_start_at', 'is', null)
    .not('scheduled_end_at', 'is', null)

  for (const task of tasks || []) {
    const shouldSync = task.sync_with_google ?? syncTasksDefault
    if (!shouldSync) continue
    if (!task.scheduled_start_at || !task.scheduled_end_at) continue

    const { data: mapping } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .eq('calendar_connection_id', connectionId)
      .eq('task_id', task.id)
      .maybeSingle()

    const payload: GoogleCalendarEventPayload = {
      summary: `[Task] ${task.title}`,
      description: task.description ? `${task.description}\n\nDayFlow Task ID: ${task.id}` : `DayFlow Task ID: ${task.id}`,
      start: { dateTime: task.scheduled_start_at, timeZone: userTimezone },
      end: { dateTime: task.scheduled_end_at, timeZone: userTimezone },
    }

    try {
      if (mapping) {
        if (new Date(task.updated_at).getTime() > new Date(mapping.last_synced_at).getTime()) {
          let patchRes = await client.patchEvent('primary', mapping.google_event_id, payload, {
            ifMatch: mapping.etag || undefined,
          })

          if (patchRes.isConflict) {
            conflictCount++
            const remote = await client.getEvent('primary', mapping.google_event_id)
            if (remote.event?.updated && new Date(remote.event.updated).getTime() > new Date(task.updated_at).getTime()) {
              // Remote is newer: reconcile task schedule
              if (remote.event.start?.dateTime && remote.event.end?.dateTime) {
                await supabase
                  .from('tasks')
                  .update({
                    scheduled_start_at: remote.event.start.dateTime,
                    scheduled_end_at: remote.event.end.dateTime,
                  })
                  .eq('id', task.id)
                  .eq('user_id', userId)
              }
              await supabase
                .from('calendar_event_mappings')
                .update({
                  etag: remote.etag || null,
                  remote_updated_at: remote.event.updated,
                  last_synced_at: new Date().toISOString(),
                  sync_status: 'synced',
                })
                .eq('id', mapping.id)
              continue
            } else {
              patchRes = await client.patchEvent('primary', mapping.google_event_id, payload, {
                ifMatch: remote.etag || undefined,
              })
            }
          }

          if (patchRes.event || patchRes.etag) {
            await supabase
              .from('calendar_event_mappings')
              .update({
                etag: patchRes.etag,
                remote_updated_at: patchRes.event?.updated || null,
                last_synced_at: new Date().toISOString(),
                sync_status: 'synced',
              })
              .eq('id', mapping.id)
            pushedCount++
          }
        }
      } else {
        const { event: createdGEvent, etag } = await client.insertEvent('primary', payload)
        if (createdGEvent.id) {
          await supabase.from('calendar_event_mappings').insert({
            user_id: userId,
            calendar_connection_id: connectionId,
            calendar_event_id: null,
            task_id: task.id,
            google_calendar_id: 'primary',
            google_event_id: createdGEvent.id,
            etag,
            remote_updated_at: createdGEvent.updated || null,
            sync_direction: 'bidirectional',
            last_synced_at: new Date().toISOString(),
            sync_status: 'synced',
          })
          pushedCount++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push error'
      errors.push({ recordId: task.id, error: msg })
    }
  }

  return { pushedCount, conflictCount, errors }
}

/**
 * Pulls changes from Google Calendar into Workday OS.
 * Follows Google pagination rules, handles HTTP 410 expired token recovery, loop prevention, and conflict resolution.
 * Persists nextSyncToken ONLY after all pages are retrieved and processed successfully.
 */
export async function pullGoogleToWorkday(
  supabase: SupabaseClient<Database>,
  connectionId: string,
  userId: string,
  client: GoogleCalendarClient,
  _userTimezone: string = 'UTC'
): Promise<{ pulledCount: number; conflictCount: number; errors: Array<{ recordId: string; error: string }>; nextSyncToken?: string }> {
  void _userTimezone
  let pulledCount = 0
  let conflictCount = 0
  const errors: Array<{ recordId: string; error: string }> = []

  // 1. Fetch current sync state
  const { data: syncState } = await supabase
    .from('calendar_sync_state')
    .select('*')
    .eq('calendar_connection_id', connectionId)
    .eq('google_calendar_id', 'primary')
    .maybeSingle()

  const syncToken = syncState?.sync_token || undefined

  // 2. Query Google Events with pagination
  const allIncomingItems: GoogleCalendarEventPayload[] = []
  let pageToken: string | undefined = undefined
  let finalSyncToken: string | undefined = undefined
  let isFullReconciliation = false

  do {
    const listRes = await client.listEvents('primary', {
      syncToken: isFullReconciliation ? undefined : syncToken,
      pageToken,
      singleEvents: true,
      maxResults: 100,
    })

    // HTTP 410 Recovery: expired sync token -> perform bounded window sweep (-30d to +90d)
    if (listRes.isSyncTokenInvalid && !isFullReconciliation) {
      isFullReconciliation = true
      allIncomingItems.length = 0
      pageToken = undefined

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const ninetyDaysAhead = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

      // Reset local sync token
      await supabase
        .from('calendar_sync_state')
        .update({ sync_token: null })
        .eq('calendar_connection_id', connectionId)
        .eq('google_calendar_id', 'primary')

      const recoveryRes = await client.listEvents('primary', {
        timeMin: thirtyDaysAgo,
        timeMax: ninetyDaysAhead,
        singleEvents: true,
        maxResults: 100,
      })

      if (recoveryRes.items && recoveryRes.items.length > 0) {
        allIncomingItems.push(...recoveryRes.items)
      }
      pageToken = recoveryRes.nextPageToken
      finalSyncToken = recoveryRes.nextSyncToken
      continue
    }

    if (listRes.items && listRes.items.length > 0) {
      allIncomingItems.push(...listRes.items)
    }

    pageToken = listRes.nextPageToken
    if (!pageToken && listRes.nextSyncToken) {
      finalSyncToken = listRes.nextSyncToken
    }
  } while (pageToken)

  // 3. Process all fetched incoming Google Events
  for (const item of allIncomingItems) {
    if (!item.id) continue

    const { data: mapping } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .eq('calendar_connection_id', connectionId)
      .eq('google_calendar_id', 'primary')
      .eq('google_event_id', item.id)
      .maybeSingle()

    // A. Deletion & Cancellation Semantics
    if (item.status === 'cancelled') {
      if (mapping) {
        if (mapping.task_id) {
          // CANONICAL TASK PROTECTION:
          // Clear scheduled times, but NEVER delete task or its deadline!
          await supabase
            .from('tasks')
            .update({
              scheduled_start_at: null,
              scheduled_end_at: null,
              is_time_blocked: false,
            })
            .eq('id', mapping.task_id)
            .eq('user_id', userId)

          await supabase.from('calendar_event_mappings').delete().eq('id', mapping.id)
          pulledCount++
        } else if (mapping.calendar_event_id) {
          // Delete local calendar event and mapping
          await supabase.from('calendar_event_mappings').delete().eq('id', mapping.id)
          await supabase
            .from('calendar_events')
            .delete()
            .eq('id', mapping.calendar_event_id)
            .eq('user_id', userId)
          pulledCount++
        }
      }
      continue
    }

    // B. Loop Prevention: ETag and Remote Modification Timestamp Checks
    if (mapping) {
      // If ETag matches our previous recorded sync ETag, skip (no change on Google)
      if (mapping.etag && item.etag && mapping.etag === item.etag) {
        continue
      }
      // If remote_updated_at indicates remote has not changed since our last pull
      if (
        mapping.remote_updated_at &&
        item.updated &&
        new Date(item.updated).getTime() <= new Date(mapping.remote_updated_at).getTime()
      ) {
        continue
      }
    }

    // Parse start and end timestamps
    const startIso =
      item.start?.dateTime ||
      (item.start?.date ? `${item.start.date}T00:00:00.000Z` : new Date().toISOString())
    const endIso =
      item.end?.dateTime ||
      (item.end?.date ? `${item.end.date}T00:00:00.000Z` : new Date(Date.now() + 3600000).toISOString())
    const isAllDay = Boolean(item.start?.date && !item.start?.dateTime)

    // C. Reconcile existing mapped record
    if (mapping) {
      if (mapping.calendar_event_id) {
        const { data: localEvent } = await supabase
          .from('calendar_events')
          .select('id, updated_at')
          .eq('id', mapping.calendar_event_id)
          .eq('user_id', userId)
          .maybeSingle()

        if (localEvent) {
          // Conflict Detection: local was also updated after last sync
          if (new Date(localEvent.updated_at).getTime() > new Date(mapping.last_synced_at).getTime()) {
            conflictCount++
            // Documented policy: compare local vs remote update times
            if (item.updated && new Date(localEvent.updated_at).getTime() > new Date(item.updated).getTime()) {
              // Local is newer: preserve local edit; will be pushed outbound
              continue
            }
          }

          // Remote is newer or local was untouched: apply remote update
          await supabase
            .from('calendar_events')
            .update({
              title: item.summary || 'Untitled Event',
              description: item.description || null,
              location: item.location || null,
              start_time: startIso,
              end_time: endIso,
              is_all_day: isAllDay,
            })
            .eq('id', localEvent.id)
            .eq('user_id', userId)

          await supabase
            .from('calendar_event_mappings')
            .update({
              etag: item.etag || null,
              remote_updated_at: item.updated || null,
              last_synced_at: new Date().toISOString(),
              sync_status: 'synced',
            })
            .eq('id', mapping.id)

          pulledCount++
        }
      } else if (mapping.task_id) {
        // Time-blocked task mapping: reconcile schedule times
        const { data: localTask } = await supabase
          .from('tasks')
          .select('id, updated_at')
          .eq('id', mapping.task_id)
          .eq('user_id', userId)
          .maybeSingle()

        if (localTask) {
          if (new Date(localTask.updated_at).getTime() > new Date(mapping.last_synced_at).getTime()) {
            conflictCount++
            if (item.updated && new Date(localTask.updated_at).getTime() > new Date(item.updated).getTime()) {
              continue
            }
          }

          await supabase
            .from('tasks')
            .update({
              scheduled_start_at: startIso,
              scheduled_end_at: endIso,
              is_time_blocked: true,
            })
            .eq('id', localTask.id)
            .eq('user_id', userId)

          await supabase
            .from('calendar_event_mappings')
            .update({
              etag: item.etag || null,
              remote_updated_at: item.updated || null,
              last_synced_at: new Date().toISOString(),
              sync_status: 'synced',
            })
            .eq('id', mapping.id)

          pulledCount++
        }
      }
    } else {
      // D. Unmapped Remote Event Import (with Duplicate Detection)
      const eventTitle = item.summary || 'Untitled Google Event'

      // Check if an existing unmapped event matches title and start time
      const { data: duplicateCandidate } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('user_id', userId)
        .eq('title', eventTitle)
        .eq('start_time', startIso)
        .maybeSingle()

      let targetEventId: string

      if (duplicateCandidate) {
        targetEventId = duplicateCandidate.id
      } else {
        const { data: createdEvent, error: insertError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: userId,
            title: eventTitle,
            description: item.description || null,
            location: item.location || null,
            start_time: startIso,
            end_time: endIso,
            is_all_day: isAllDay,
            event_type: 'external',
          })
          .select('id')
          .single()

        if (insertError || !createdEvent) {
          errors.push({ recordId: item.id, error: insertError?.message || 'Failed to import event' })
          continue
        }
        targetEventId = createdEvent.id
      }

      await supabase.from('calendar_event_mappings').insert({
        user_id: userId,
        calendar_connection_id: connectionId,
        calendar_event_id: targetEventId,
        task_id: null,
        google_calendar_id: 'primary',
        google_event_id: item.id,
        etag: item.etag || null,
        remote_updated_at: item.updated || null,
        sync_direction: 'bidirectional',
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })

      pulledCount++
    }
  }

  // 4. Persist new sync token ONLY after all pages are completely processed
  if (finalSyncToken) {
    if (syncState) {
      await supabase
        .from('calendar_sync_state')
        .update({
          sync_token: finalSyncToken,
          last_successful_sync: new Date().toISOString(),
        })
        .eq('id', syncState.id)
    } else {
      await supabase.from('calendar_sync_state').insert({
        calendar_connection_id: connectionId,
        google_calendar_id: 'primary',
        sync_token: finalSyncToken,
        last_successful_sync: new Date().toISOString(),
      })
    }
  }

  return {
    pulledCount,
    conflictCount,
    errors,
    nextSyncToken: finalSyncToken,
  }
}

/**
 * Executes a full round-trip bidirectional synchronization for the user.
 * Implements concurrency coordination/locking to prevent cursor races.
 */
export async function executeBidirectionalSync(
  supabase: SupabaseClient<Database>,
  userId: string,
  userTimezone: string = 'UTC'
): Promise<SyncResult> {
  const tokenData = await getValidAccessTokenForUser(supabase, userId)
  if (!tokenData) {
    throw new Error('Google Calendar connection is not active or token could not be verified.')
  }

  const { connectionId } = tokenData

  // 1. Concurrency Check: prevent overlapping sync runs on the same connection
  const { data: syncState } = await supabase
    .from('calendar_sync_state')
    .select('*')
    .eq('calendar_connection_id', connectionId)
    .eq('google_calendar_id', 'primary')
    .maybeSingle()

  if (syncState && syncState.sync_status === 'syncing' && syncState.sync_started_at) {
    const elapsedMs = Date.now() - new Date(syncState.sync_started_at).getTime()
    // Lock expires after 90 seconds
    if (elapsedMs < 90000) {
      return {
        pulledCount: 0,
        pushedCount: 0,
        conflictCount: 0,
        errors: [{ recordId: connectionId, error: 'A sync run is already in progress for this connection.' }],
      }
    }
  }

  // Acquire sync lock
  const syncStartedAt = new Date().toISOString()
  if (syncState) {
    await supabase
      .from('calendar_sync_state')
      .update({
        sync_status: 'syncing',
        sync_started_at: syncStartedAt,
      })
      .eq('id', syncState.id)
  }

  const client = new GoogleCalendarClient(tokenData.accessToken)
  let pullResult: {
    pulledCount: number
    conflictCount: number
    errors: Array<{ recordId: string; error: string }>
    nextSyncToken?: string
  } = { pulledCount: 0, conflictCount: 0, errors: [] }
  let pushResult = { pushedCount: 0, conflictCount: 0, errors: [] as Array<{ recordId: string; error: string }> }

  try {
    // 2. Inbound Pull
    pullResult = await pullGoogleToWorkday(
      supabase,
      connectionId,
      userId,
      client,
      userTimezone
    )

    // 3. Outbound Push
    pushResult = await pushWorkdayToGoogle(
      supabase,
      connectionId,
      userId,
      client,
      userTimezone
    )

    // Update sync state to idle with updated metrics
    if (syncState) {
      await supabase
        .from('calendar_sync_state')
        .update({
          sync_status: 'idle',
          last_successful_sync: new Date().toISOString(),
          last_pushed_count: pushResult.pushedCount,
          last_pulled_count: pullResult.pulledCount,
          last_conflict_count: pullResult.conflictCount + pushResult.conflictCount,
          last_error_message: null,
        })
        .eq('id', syncState.id)
    }

    return {
      pulledCount: pullResult.pulledCount,
      pushedCount: pushResult.pushedCount,
      conflictCount: pullResult.conflictCount + pushResult.conflictCount,
      errors: [...pullResult.errors, ...pushResult.errors],
      nextSyncToken: pullResult.nextSyncToken,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Sync execution failed'
    if (syncState) {
      await supabase
        .from('calendar_sync_state')
        .update({
          sync_status: 'error',
          last_error_message: errorMsg,
        })
        .eq('id', syncState.id)
    }
    throw err
  }
}
