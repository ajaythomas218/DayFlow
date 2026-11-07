'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ActionResponse } from '@/types'
import { decryptToken } from '@/lib/google-calendar/crypto'
import { revokeGoogleToken } from '@/lib/google-calendar/oauth'
import { executeBidirectionalSync } from '@/lib/google-calendar/sync'
import { SyncResult } from '@/lib/google-calendar/types'

export interface GoogleConnectionStatus {
  isConnected: boolean
  accountEmail: string | null
  tokenExpiresAt: string | null
  lastSuccessfulSync: string | null
  lastErrorMessage: string | null
  autoSyncTasks: boolean
  autoSyncEvents: boolean
}

/**
 * Retrieves the current Google Calendar connection and sync health status.
 */
export async function getGoogleCalendarConnectionAction(): Promise<
  ActionResponse<GoogleConnectionStatus>
> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle()

    const { data: settings } = await supabase
      .from('user_settings')
      .select('auto_sync_tasks_to_calendar, auto_sync_events_to_calendar')
      .eq('user_id', user.id)
      .single()

    if (!connection) {
      return {
        success: true,
        data: {
          isConnected: false,
          accountEmail: null,
          tokenExpiresAt: null,
          lastSuccessfulSync: null,
          lastErrorMessage: null,
          autoSyncTasks: settings?.auto_sync_tasks_to_calendar ?? false,
          autoSyncEvents: settings?.auto_sync_events_to_calendar ?? true,
        },
      }
    }

    const { data: syncState } = await supabase
      .from('calendar_sync_state')
      .select('last_successful_sync, last_error_message')
      .eq('calendar_connection_id', connection.id)
      .eq('google_calendar_id', 'primary')
      .maybeSingle()

    return {
      success: true,
      data: {
        isConnected: true,
        accountEmail: connection.account_email,
        tokenExpiresAt: connection.token_expires_at,
        lastSuccessfulSync: syncState?.last_successful_sync || null,
        lastErrorMessage: syncState?.last_error_message || null,
        autoSyncTasks: settings?.auto_sync_tasks_to_calendar ?? false,
        autoSyncEvents: settings?.auto_sync_events_to_calendar ?? true,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to query Google Calendar connection'
    return { success: false, error: msg }
  }
}

/**
 * Disconnects Google Calendar: revokes token at Google and deletes connection record.
 */
export async function disconnectGoogleCalendarAction(): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle()

    if (connection) {
      try {
        const plainRefreshToken = decryptToken(connection.encrypted_refresh_token)
        if (plainRefreshToken) {
          await revokeGoogleToken(plainRefreshToken)
        }
      } catch {
        // Continue disconnect even if remote revocation returns an error
      }

      await supabase.from('calendar_connections').delete().eq('id', connection.id)
    }

    revalidatePath('/settings')
    revalidatePath('/calendar')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to disconnect Google Calendar'
    return { success: false, error: msg }
  }
}

/**
 * Triggers an on-demand bidirectional synchronization with Google Calendar.
 */
export async function triggerGoogleCalendarSyncAction(): Promise<ActionResponse<SyncResult>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .single()

    const userTimezone = profile?.timezone || 'UTC'

    const syncResult = await executeBidirectionalSync(supabase, user.id, userTimezone)

    revalidatePath('/calendar')
    revalidatePath('/tasks')
    revalidatePath('/dashboard')
    revalidatePath('/settings')

    return { success: true, data: syncResult }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync execution failed'
    return { success: false, error: msg }
  }
}

/**
 * Updates Google Calendar auto-sync default preferences.
 */
export async function updateGoogleSyncPreferencesAction(preferences: {
  autoSyncTasks?: boolean
  autoSyncEvents?: boolean
}): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const updates: {
      auto_sync_tasks_to_calendar?: boolean
      auto_sync_events_to_calendar?: boolean
    } = {}

    if (preferences.autoSyncTasks !== undefined) {
      updates.auto_sync_tasks_to_calendar = preferences.autoSyncTasks
    }
    if (preferences.autoSyncEvents !== undefined) {
      updates.auto_sync_events_to_calendar = preferences.autoSyncEvents
    }

    const { error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update sync preferences'
    return { success: false, error: msg }
  }
}

